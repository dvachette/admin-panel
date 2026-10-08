import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

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
    const src = path.join(SITES_AVAILABLE, name)
    const dest = path.join(SITES_ENABLED, name)
    await execAsync(`sudo ln -s ${src} ${dest}`)
}

export async function disableVhost(name: string) {
    const dest = path.join(SITES_ENABLED, name)
    await execAsync(`sudo rm ${dest}`)
}

export async function deleteVhost(name: string) {
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