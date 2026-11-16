export type Health = 'healthy' | 'unhealthy' | 'starting' | null

export interface ContainerPort {
  /** Host IPs the port is bound to (IPv4 and IPv6 bindings merged) */
  ips: string[]
  privatePort: number
  publicPort?: number
  type: string
}

export interface Container {
  id: string
  name: string
  image: string
  /** Raw Docker status, e.g. "Up 3 hours (healthy)", "Exited (0) 2 days ago" */
  status: string
  state: string
  health: Health
  /** Unix timestamp (s) */
  created: number
  /** docker compose project and service, null for standalone containers */
  project: string | null
  service: string | null
  ports: ContainerPort[]
}

export interface ContainerStats {
  cpu: number
  memUsage: number
  memLimit: number
  memPercent: number
}

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary'

const STATE_LABELS: Record<string, { label: string; severity: Severity }> = {
  running: { label: 'En marche', severity: 'success' },
  exited: { label: 'Arrêté', severity: 'secondary' },
  created: { label: 'Créé', severity: 'secondary' },
  restarting: { label: 'Redémarre', severity: 'warn' },
  paused: { label: 'En pause', severity: 'warn' },
  removing: { label: 'Suppression', severity: 'warn' },
  dead: { label: 'Mort', severity: 'danger' },
}

export function stateTag(container: Container): { label: string; severity: Severity } {
  const base = STATE_LABELS[container.state] ?? { label: container.state, severity: 'secondary' }
  const exitCode = container.status.match(/^Exited \((\d+)\)/)?.[1]
  // A non-zero exit code means the container crashed (143 = SIGTERM, a regular `docker stop`)
  if (exitCode !== undefined && exitCode !== '0' && exitCode !== '143') {
    return { label: `Arrêté (code ${exitCode})`, severity: 'danger' }
  }
  return base
}

export const HEALTH_LABELS: Record<Exclude<Health, null>, { label: string; severity: Severity }> = {
  healthy: { label: 'sain', severity: 'success' },
  unhealthy: { label: 'malade', severity: 'danger' },
  starting: { label: 'démarrage', severity: 'info' },
}

const UNITS: [RegExp, string][] = [
  [/\bLess than a second\b/i, 'moins d’une seconde'],
  [/\bAbout an? (\w+)/i, '1 $1'],
  [/\bseconds?\b/, 's'],
  [/\bminutes?\b/, 'min'],
  [/\bhours?\b/, 'h'],
  [/\bdays?\b/, 'j'],
  [/\bweeks?\b/, 'sem.'],
  [/\bmonths?\b/, 'mois'],
  [/\byears?\b/, 'an(s)'],
]

function translateDuration(text: string): string {
  return UNITS.reduce((acc, [re, fr]) => acc.replace(re, fr), text).trim()
}

/** "Up 3 hours (healthy)" -> "depuis 3 h", "Exited (0) 2 days ago" -> "il y a 2 j" */
export function sinceLabel(container: Container): string {
  const up = container.status.match(/^Up (.+?)(?: \(.*\))?$/)
  if (up) return `depuis ${translateDuration(up[1]!)}`
  const ago = container.status.match(/^\w+(?: \(\d+\))? (.+) ago$/)
  if (ago) return `il y a ${translateDuration(ago[1]!)}`
  return ''
}

/** "ghcr.io/org/app:1.2@sha256:..." -> "org/app:1.2", a bare digest -> its first 12 chars */
export function shortImage(image: string): string {
  if (image.startsWith('sha256:')) return image.slice(7, 19)
  const withoutDigest = image.split('@')[0]!
  const parts = withoutDigest.split('/')
  // drop the registry host (contains a dot or a port)
  if (parts.length > 1 && /[.:]/.test(parts[0]!)) parts.shift()
  return parts.join('/')
}

/** Bound on every interface: reachable from outside, Docker's iptables rules bypass ufw */
export function isPubliclyExposed(port: ContainerPort): boolean {
  return port.publicPort !== undefined && port.ips.some((ip) => ip === '0.0.0.0' || ip === '::')
}
