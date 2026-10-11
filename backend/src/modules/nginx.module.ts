import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const SITES_AVAILABLE = '/etc/nginx/sites-available'
const SITES_ENABLED = '/etc/nginx/sites-enabled'

export async function getNginxStatus(): Promise<'active' | 'inactive'> {
    try {
        const { stdout } = await execAsync('sudo systemctl is-active nginx')
        return stdout.trim() === 'active' ? 'active' : 'inactive'
    } catch {
        return 'inactive'
    }
}

export async function startNginx() {
    await execAsync('sudo systemctl start nginx')
}

export async function stopNginx() {
    await execAsync('sudo systemctl stop nginx')
}

export async function reloadNginx() {
    await execAsync('sudo systemctl reload nginx')
}

export interface VhostInfo {
    name: string
    enabled: boolean
    serverNames: string[]
    listenPorts: number[]
    proxyTargets: string[]
    proxyPorts: number[]
    root: string | null
    ssl: boolean
    parseError: boolean
}

function stripComments(content: string): string {
    return content.replace(/(^|\s)#.*$/gm, '$1')
}

function matchAll(content: string, directive: string): string[][] {
    const regex: RegExp = new RegExp(`^\\s*${directive}\\s+([^;]+);`, 'gm')
    return [...content.matchAll(regex)].map((m: RegExpMatchArray): string[] =>
        m[1].trim().split(/\s+/)
    )
}

function unique<T>(values: T[]): T[] {
    return [...new Set(values)]
}

function parseListenPort(tokens: string[]): number | null {
    const match: RegExpMatchArray | null = tokens[0].match(/(?:^|:)(\d+)$/)
    return match ? Number(match[1]) : null
}

function parseProxyPort(target: string): number | null {
    const match: RegExpMatchArray | null = target.match(/^[a-z]+:\/\/[^/:]+:(\d+)/)
    return match ? Number(match[1]) : null
}

function parseVhost(name: string, enabled: boolean, raw: string): VhostInfo {
    const content: string = stripComments(raw)
    const listens: string[][] = matchAll(content, 'listen')
    const proxyTargets: string[] = unique(matchAll(content, 'proxy_pass').map((t: string[]): string => t[0]))
    const roots: string[][] = matchAll(content, 'root')

    return {
        name,
        enabled,
        serverNames: unique(matchAll(content, 'server_name').flat()),
        listenPorts: unique(
            listens.map(parseListenPort).filter((p: number | null): p is number => p !== null)
        ),
        proxyTargets,
        proxyPorts: unique(
            proxyTargets.map(parseProxyPort).filter((p: number | null): p is number => p !== null)
        ),
        root: roots.length > 0 ? roots[0][0] : null,
        ssl: listens.some((t: string[]): boolean => t.includes('ssl')) || /^\s*ssl_certificate\s/m.test(content),
        parseError: false
    }
}

export async function listVhosts(): Promise<VhostInfo[]> {
    const files: string[] = await fs.readdir(SITES_AVAILABLE)
    const vhosts: VhostInfo[] = await Promise.all(
        files.map(async (file: string): Promise<VhostInfo> => {
            const enabled: boolean = await fs
                .access(path.join(SITES_ENABLED, file))
                .then((): boolean => true)
                .catch((): boolean => false)
            try {
                const raw: string = await fs.readFile(path.join(SITES_AVAILABLE, file), 'utf-8')
                return parseVhost(file, enabled, raw)
            } catch {
                return {
                    name: file, enabled, serverNames: [], listenPorts: [], proxyTargets: [],
                    proxyPorts: [], root: null, ssl: false, parseError: true
                }
            }
        })
    )
    return vhosts.sort((a: VhostInfo, b: VhostInfo): number => a.name.localeCompare(b.name))
}

export async function enableVhost(name: string) {
    assertSafeName(name)
    const src = path.join(SITES_AVAILABLE, name)
    const dest = path.join(SITES_ENABLED, name)
    await execAsync(`sudo ln -s ${src} ${dest}`)
}

export async function disableVhost(name: string) {
    assertSafeName(name)
    const dest = path.join(SITES_ENABLED, name)
    await execAsync(`sudo rm ${dest}`)
}

export async function deleteVhost(name: string) {
    assertSafeName(name)
    await disableVhost(name).catch(() => { })
    await execAsync(`sudo rm ${path.join(SITES_AVAILABLE, name)}`)
}

export interface VhostConfig {
    name: string
    serverName: string
    mode: 'proxy' | 'static'
    proxyPort?: number
    root?: string
    ssl: boolean
}

export async function createVhost(cfg: VhostConfig) {
    assertSafeName(cfg.name)
    assertHost(cfg.serverName)
    if (cfg.mode === 'proxy') {
        assertPort(cfg.proxyPort)
    } else {
        assertRoot(cfg.root)
    }
    let conf = ''

    if (cfg.ssl) {
        conf = `server {
    listen 80;
    server_name ${cfg.serverName};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${cfg.serverName};

    ssl_certificate /etc/letsencrypt/live/${cfg.serverName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${cfg.serverName}/privkey.pem;

    ${cfg.mode === 'proxy'
                ? `location / {
        proxy_pass http://localhost:${cfg.proxyPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }`
                : `root ${cfg.root};
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }`}
}`
    } else {
        conf = `server {
    listen 80;
    server_name ${cfg.serverName};

    ${cfg.mode === 'proxy'
                ? `location / {
        proxy_pass http://localhost:${cfg.proxyPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }`
                : `root ${cfg.root};
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }`}
}`
    }

    const tmpFile = path.join(os.tmpdir(), `nginx-${cfg.name}-${Date.now()}.conf`)
    await fs.writeFile(tmpFile, conf, 'utf-8')
    await execAsync(`sudo mv ${tmpFile} ${path.join(SITES_AVAILABLE, cfg.name)}`)
    await execAsync(`sudo chmod 644 ${path.join(SITES_AVAILABLE, cfg.name)}`)
}


export class VhostError extends Error {
    public readonly status: number

    public constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

export interface ProxyPortChange {
    from: string
    port: number
}

export interface VhostUpdate {
    serverName?: string
    root?: string
    proxyChanges?: ProxyPortChange[]
}

export interface VhostUpdateResult {
    name: string
    validated: boolean
    warnings: string[]
}

interface Replaced {
    content: string
    count: number
}

const NAME_REGEX: RegExp = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,252}$/
const HOST_REGEX: RegExp = /^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/
const ROOT_REGEX: RegExp = /^\/[A-Za-z0-9._/-]*$/
const TARGET_REGEX: RegExp = /^([a-z]+:\/\/[^/:]+):(\d+)(.*)$/

export function assertSafeName(name: string): void {
    if (!NAME_REGEX.test(name)) {
        throw new VhostError('Nom de vhost invalide', 400)
    }
}

export function assertHost(value: unknown): void {
    if (typeof value !== 'string' || !HOST_REGEX.test(value)) {
        throw new VhostError('server_name invalide', 400)
    }
}

export function assertPort(value: unknown): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
        throw new VhostError('Port invalide (1 à 65535)', 400)
    }
}

export function assertRoot(value: unknown): void {
    if (typeof value !== 'string' || !ROOT_REGEX.test(value)) {
        throw new VhostError('root invalide', 400)
    }
}

function validateUpdate(update: VhostUpdate): void {
    if (update.serverName !== undefined) {
        assertHost(update.serverName)
    }
    if (update.root !== undefined) {
        assertRoot(update.root)
    }
    for (const change of update.proxyChanges ?? []) {
        assertPort(change.port)
        if (typeof change.from !== 'string') {
            throw new VhostError('Cible proxy invalide', 400)
        }
    }
}

async function runSudo(args: string[]): Promise<void> {
    await execFileAsync('sudo', args)
}

async function pathExists(target: string): Promise<boolean> {
    return fs.access(target).then((): boolean => true).catch((): boolean => false)
}

function extractStderr(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'stderr' in error) {
        const stderr: unknown = (error as { stderr: unknown }).stderr
        if (typeof stderr === 'string') {
            return stderr.trim()
        }
    }
    return 'erreur inconnue'
}

async function writeAvailable(name: string, content: string): Promise<void> {
    const tmpFile: string = path.join(os.tmpdir(), `nginx-${name}-${Date.now()}.conf`)
    const dest: string = path.join(SITES_AVAILABLE, name)
    await fs.writeFile(tmpFile, content, 'utf-8')
    await runSudo(['mv', tmpFile, dest])
    await runSudo(['chmod', '644', dest])
}

function replaceValues(
    content: string,
    directive: string,
    transform: (value: string) => string
): Replaced {
    const regex: RegExp = new RegExp(`^(\\s*${directive}\\s+)([^;]+)(;)`, 'gm')
    let count: number = 0
    const next: string = content.replace(
        regex,
        (match: string, prefix: string, value: string, suffix: string): string => {
            const trimmed: string = value.trim()
            const updated: string = transform(trimmed)
            if (updated === trimmed) {
                return match
            }
            count += 1
            return `${prefix}${updated}${suffix}`
        }
    )
    return { content: next, count }
}

function withPort(target: string, port: number): string {
    const match: RegExpMatchArray | null = target.match(TARGET_REGEX)
    if (match === null) {
        throw new VhostError(`Cible sans port modifiable : ${target}`, 400)
    }
    return `${match[1]}:${port}${match[3]}`
}

function applyUpdate(content: string, info: VhostInfo, update: VhostUpdate): string {
    let result: string = content

    for (const change of update.proxyChanges ?? []) {
        const to: string = withPort(change.from, change.port)
        if (to === change.from) {
            continue
        }
        const replaced: Replaced = replaceValues(
            result,
            'proxy_pass',
            (value: string): string => (value === change.from ? to : value)
        )
        if (replaced.count === 0) {
            throw new VhostError(`Cible introuvable : ${change.from}`, 400)
        }
        result = replaced.content
    }

    const oldServerName: string | undefined = info.serverNames[0]
    if (update.serverName !== undefined && update.serverName !== oldServerName) {
        if (oldServerName === undefined) {
            throw new VhostError('Aucun server_name à modifier', 400)
        }
        const newServerName: string = update.serverName
        const replaced: Replaced = replaceValues(
            result,
            'server_name',
            (value: string): string =>
                value
                    .split(/\s+/)
                    .map((token: string): string => (token === oldServerName ? newServerName : token))
                    .join(' ')
        )
        result = replaced.content
    }

    if (update.root !== undefined && update.root !== info.root) {
        if (info.root === null) {
            throw new VhostError('Aucun root à modifier', 400)
        }
        const oldRoot: string = info.root
        const newRoot: string = update.root
        result = replaceValues(
            result,
            'root',
            (value: string): string => (value === oldRoot ? newRoot : value)
        ).content
    }

    return result
}

export async function updateVhost(name: string, update: VhostUpdate): Promise<VhostUpdateResult> {
    assertSafeName(name)
    validateUpdate(update)

    const oldPath: string = path.join(SITES_AVAILABLE, name)
    const oldLink: string = path.join(SITES_ENABLED, name)

    let oldContent: string
    try {
        oldContent = await fs.readFile(oldPath, 'utf-8')
    } catch {
        throw new VhostError('Vhost introuvable', 404)
    }

    const enabled: boolean = await pathExists(oldLink)
    const info: VhostInfo = parseVhost(name, enabled, oldContent)
    const newContent: string = applyUpdate(oldContent, info, update)
    const warnings: string[] = []

    if (newContent === oldContent) {
        return { name, validated: false, warnings: ['Aucune modification'] }
    }

    const domainChanged: boolean =
        update.serverName !== undefined && update.serverName !== info.serverNames[0]
    const newName: string = update.serverName !== undefined && domainChanged ? update.serverName : name
    const renamed: boolean = newName !== name
    const newPath: string = path.join(SITES_AVAILABLE, newName)
    const newLink: string = path.join(SITES_ENABLED, newName)

    if (renamed && (await pathExists(newPath))) {
        throw new VhostError(`Le vhost "${newName}" existe déjà`, 409)
    }

    await writeAvailable(newName, newContent)
    if (renamed && enabled) {
        await runSudo(['ln', '-s', newPath, newLink])
    }

    if (enabled) {
        try {
            await runSudo(['nginx', '-t'])
        } catch (error: unknown) {
            if (renamed) {
                await runSudo(['rm', newLink]).catch((): void => undefined)
                await runSudo(['rm', newPath]).catch((): void => undefined)
            } else {
                await writeAvailable(name, oldContent)
            }
            throw new VhostError(`nginx -t a échoué, modification annulée : ${extractStderr(error)}`, 422)
        }
    } else {
        warnings.push('Vhost désactivé : configuration non testée par nginx')
    }

    if (renamed) {
        if (enabled) {
            await runSudo(['rm', oldLink])
        }
        await runSudo(['rm', oldPath])
    }

    if (domainChanged && info.ssl) {
        warnings.push(
            'Les chemins ssl_certificate pointent encore vers l\'ancien domaine : le certificat ne correspond plus (voir étape 3)'
        )
    }

    return { name: newName, validated: enabled, warnings }
}