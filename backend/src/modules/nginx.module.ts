import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

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

export async function listVhosts() {
    const files = await fs.readdir(SITES_AVAILABLE)
    const vhosts = await Promise.all(
        files.map(async (file) => {
            const enabledPath = path.join(SITES_ENABLED, file)
            let enabled = false
            try {
                await fs.access(enabledPath)
                enabled = true
            } catch { }
            return { name: file, enabled }
        })
    )
    return vhosts
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

    await execAsync(`echo ${JSON.stringify(conf)} | sudo tee ${path.join(SITES_AVAILABLE, cfg.name)}`)
}