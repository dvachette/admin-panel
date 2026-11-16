export interface VhostConfig {
  name: string
  serverName: string
  mode: 'proxy' | 'static'
  proxyPort?: number
  root?: string
  ssl: boolean
}

export interface Vhost {
  name: string
  enabled: boolean
  serverNames: string[]
  listenPorts: number[]
  proxyTargets: string[]
  proxyPorts: number[]
  root: string | null
  ssl: boolean
  /** Let's Encrypt certificate name referenced by ssl_certificate */
  certName: string | null
  parseError: boolean
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

export interface VhostCreateResult {
  name: string
  secured: boolean
  warnings: string[]
}

export interface Certificate {
  name: string
  domains: string[]
  /** ISO date */
  expiry: string | null
  daysLeft: number | null
  valid: boolean
}

export interface SecureResult {
  name: string
  certName: string
  /** true when a new certificate was requested, false when an existing one was installed */
  issued: boolean
}

/** Exact match, or `*.example.com` matching a single label (same rule as certbot). */
export function coversDomain(cert: Certificate, host: string): boolean {
  const target = host.toLowerCase()
  return cert.domains.some((domain) => {
    const d = domain.toLowerCase()
    if (d === target) return true
    if (!d.startsWith('*.')) return false
    const dot = target.indexOf('.')
    return dot > 0 && target.slice(dot + 1) === d.slice(2)
  })
}

export function findCoveringCertificate(certs: Certificate[], host: string): Certificate | null {
  return (
    certs
      .filter((c) => c.valid && coversDomain(c, host))
      .sort((a, b) => (b.daysLeft ?? 0) - (a.daysLeft ?? 0))[0] ?? null
  )
}
