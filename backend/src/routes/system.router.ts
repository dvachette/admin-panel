import { Router, type Response } from "express";
import { getSystemMetrics, listListeningPorts } from "../modules/system.module";
import { addRule, deleteRules, FirewallError, getFirewallStatus, type NewRule, type RuleRef } from "../modules/firewall.module";

export const systemRouter = Router();

function sendError(res: Response, err: unknown, fallback: string) {
    if (err instanceof FirewallError) {
        res.status(err.status).json({ error: err.message });
    } else {
        console.error(err);
        res.status(500).json({ error: fallback });
    }
}

systemRouter.get("/metrics", async (req, res) => {
    try {
        res.json(await getSystemMetrics());
    } catch (err) {
        sendError(res, err, "Failed to read system metrics");
    }
});

systemRouter.get("/ports", async (req, res) => {
    try {
        res.json(await listListeningPorts());
    } catch (err) {
        sendError(res, err, "Failed to list listening ports (ss)");
    }
});

systemRouter.get("/firewall", async (req, res) => {
    try {
        res.json(await getFirewallStatus());
    } catch (err) {
        sendError(res, err, "Failed to read ufw status");
    }
});

systemRouter.post("/firewall/rules", async (req, res) => {
    try {
        await addRule(req.body as NewRule);
        res.json(await getFirewallStatus());
    } catch (err) {
        sendError(res, err, "Failed to add ufw rule");
    }
});

/** Body: { rules: [{ number, text }] } (a POST: DELETE bodies are poorly supported) */
systemRouter.post("/firewall/rules/delete", async (req, res) => {
    try {
        await deleteRules((req.body?.rules ?? []) as RuleRef[]);
        res.json(await getFirewallStatus());
    } catch (err) {
        sendError(res, err, "Failed to delete ufw rule");
    }
});
