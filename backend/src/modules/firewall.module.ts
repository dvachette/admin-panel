import { runHelper, HelperError } from "./privileged";

export class FirewallError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export interface FirewallRule {
    number: number;
    /** Destination as printed by ufw: "22/tcp", "80,443/tcp", "Nginx Full", "8080"... */
    to: string;
    /** "ALLOW IN", "DENY IN", "REJECT IN", "LIMIT IN", "ALLOW OUT"... */
    action: string;
    from: string;
    v6: boolean;
    comment: string | null;
    /** Raw line without its number, used to check a rule did not change before deleting it */
    text: string;
}

export interface FirewallStatus {
    active: boolean;
    logging: string | null;
    defaults: { incoming: string; outgoing: string; routed: string } | null;
    rules: FirewallRule[];
}

/** "Default: deny (incoming), allow (outgoing), disabled (routed)" */
function parseDefaults(verbose: string): FirewallStatus["defaults"] {
    const line = verbose.match(/^Default:\s*(.+)$/m)?.[1];
    if (!line) return null;
    const policy = (direction: string) => line.match(new RegExp(`(\\w+) \\(${direction}\\)`))?.[1] ?? "?";
    return { incoming: policy("incoming"), outgoing: policy("outgoing"), routed: policy("routed") };
}

const RULE_REGEX = /^\[\s*(\d+)\]\s+(.+?)\s{2,}((?:ALLOW|DENY|REJECT|LIMIT)(?: (?:IN|OUT|FWD))?)\s{2,}(.+?)\s*$/;

/** `ufw status numbered` lines: "[ 2] 5432/tcp   ALLOW IN    10.0.0.0/24   # db" */
export function parseNumberedRules(numbered: string): FirewallRule[] {
    const rules: FirewallRule[] = [];
    for (const raw of numbered.split("\n")) {
        const match = raw.match(RULE_REGEX);
        if (!match) continue;
        let from = match[4];
        let comment: string | null = null;
        const commentIndex = from.indexOf(" # ");
        if (commentIndex !== -1) {
            comment = from.slice(commentIndex + 3).trim();
            from = from.slice(0, commentIndex).trim();
        }
        const to = match[2].trim();
        rules.push({
            number: Number(match[1]),
            to: to.replace(/\s*\(v6\)$/, ""),
            action: match[3],
            from: from.replace(/\s*\((v6|out|fwd)\)/g, "").trim(),
            v6: /\(v6\)/.test(to) || /\(v6\)/.test(from),
            comment,
            text: raw.replace(/^\[\s*\d+\]\s*/, "").trim(),
        });
    }
    return rules;
}

function helperMessage(err: unknown, fallback: string): string {
    if (err instanceof HelperError) {
        return err.stderr.trim().split("\n").pop()?.replace(/^admin-panel-helper: /, "") || fallback;
    }
    return fallback;
}

export async function getFirewallStatus(): Promise<FirewallStatus> {
    let verbose: string;
    try {
        verbose = (await runHelper(["ufw-status"])).stdout;
    } catch (err) {
        throw new FirewallError(503, `ufw indisponible : ${helperMessage(err, "erreur inconnue")}`);
    }
    const active = /^Status:\s*active/m.test(verbose);
    if (!active) {
        return { active: false, logging: null, defaults: null, rules: [] };
    }
    const numbered = (await runHelper(["ufw-rules"])).stdout;
    return {
        active,
        logging: verbose.match(/^Logging:\s*(.+)$/m)?.[1]?.trim() ?? null,
        defaults: parseDefaults(verbose),
        rules: parseNumberedRules(numbered),
    };
}

export interface NewRule {
    action: "allow" | "deny";
    port: number;
    proto: "tcp" | "udp";
    /** IP or CIDR; anywhere when omitted */
    source?: string;
}

export async function addRule(rule: NewRule): Promise<void> {
    if (rule.action !== "allow" && rule.action !== "deny") throw new FirewallError(400, "action: allow ou deny");
    if (!Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535) throw new FirewallError(400, "Port invalide (1 à 65535)");
    if (rule.proto !== "tcp" && rule.proto !== "udp") throw new FirewallError(400, "Protocole : tcp ou udp");
    const args = [`ufw-${rule.action}`, String(rule.port), rule.proto];
    if (rule.source?.trim()) args.push(rule.source.trim());
    try {
        await runHelper(args);
    } catch (err) {
        // The helper validates the source and refuses to deny SSH
        throw new FirewallError(400, helperMessage(err, "Impossible d'ajouter la règle"));
    }
}

export interface RuleRef {
    number: number;
    text: string;
}

/**
 * Deletes rules by number, after checking each one is still the rule the user saw (numbers shift
 * after every deletion and may have changed since the page was loaded). Deleted from the highest
 * number down, so the remaining numbers stay valid.
 */
export async function deleteRules(refs: RuleRef[]): Promise<void> {
    if (!Array.isArray(refs) || refs.length === 0 || refs.length > 10) throw new FirewallError(400, "1 à 10 règles");
    const current = new Map(parseNumberedRules((await runHelper(["ufw-rules"])).stdout).map((r) => [r.number, r.text]));
    for (const ref of refs) {
        if (!Number.isInteger(ref.number) || current.get(ref.number) !== ref.text) {
            throw new FirewallError(409, "Les règles ont changé depuis l'affichage : rechargez la page");
        }
    }
    const numbers = [...new Set(refs.map((r) => r.number))].sort((a, b) => b - a);
    for (const number of numbers) {
        try {
            await runHelper(["ufw-delete", String(number)]);
        } catch (err) {
            throw new FirewallError(400, helperMessage(err, `Impossible de supprimer la règle ${number}`));
        }
    }
}
