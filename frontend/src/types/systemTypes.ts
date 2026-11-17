export interface MetricsSample {
  /** Unix time (ms) */
  time: number
  cpuPercent: number
  memUsed: number
  memTotal: number
  swapUsed: number
  swapTotal: number
  /** Bytes per second */
  netRx: number
  netTx: number
  load1: number
}

export interface Disk {
  mount: string
  device: string
  fsType: string
  total: number
  used: number
  available: number
}

export interface SystemMetrics {
  host: {
    hostname: string
    os: string
    kernel: string
    cpus: number
    /** Seconds */
    uptime: number
    load: [number, number, number]
  }
  current: MetricsSample | null
  history: MetricsSample[]
  disks: Disk[]
}

export interface ListeningPort {
  proto: 'tcp' | 'udp'
  address: string
  port: number
  loopback: boolean
}

export interface FirewallRule {
  number: number
  to: string
  action: string
  from: string
  v6: boolean
  comment: string | null
  text: string
}

export interface FirewallStatus {
  active: boolean
  logging: string | null
  defaults: { incoming: string; outgoing: string; routed: string } | null
  rules: FirewallRule[]
}

export interface NewRule {
  action: 'allow' | 'deny'
  port: number
  proto: 'tcp' | 'udp'
  source?: string
}

/** IPv4 and IPv6 copies of the same rule, shown and deleted together */
export interface RuleGroup {
  key: string
  to: string
  action: string
  from: string
  comment: string | null
  v4: boolean
  v6: boolean
  rules: FirewallRule[]
}

export function groupRules(rules: FirewallRule[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>()
  for (const rule of rules) {
    const key = [rule.to, rule.action, rule.from, rule.comment ?? ''].join('|')
    const group = groups.get(key) ?? {
      key,
      to: rule.to,
      action: rule.action,
      from: rule.from,
      comment: rule.comment,
      v4: false,
      v6: false,
      rules: [],
    }
    if (rule.v6) group.v6 = true
    else group.v4 = true
    group.rules.push(rule)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** ufw application profiles commonly found on a web server */
const APP_PROFILES: Record<string, { ports: number[]; proto: 'tcp' | 'udp' }> = {
  OpenSSH: { ports: [22], proto: 'tcp' },
  'Nginx HTTP': { ports: [80], proto: 'tcp' },
  'Nginx HTTPS': { ports: [443], proto: 'tcp' },
  'Nginx Full': { ports: [80, 443], proto: 'tcp' },
  'WWW': { ports: [80], proto: 'tcp' },
  'WWW Secure': { ports: [443], proto: 'tcp' },
  'WWW Full': { ports: [80, 443], proto: 'tcp' },
}

/** Whether the destination of a rule ("22/tcp", "80,443/tcp", "6000:6007/tcp", "8080", "Nginx Full") covers a port */
export function ruleCoversPort(to: string, port: number, proto: 'tcp' | 'udp'): boolean {
  const destination = to.replace(/ on \S+$/, '').trim()
  const profile = APP_PROFILES[destination]
  if (profile) return profile.proto === proto && profile.ports.includes(port)
  const match = destination.match(/^([\d,:]+)(?:\/(tcp|udp))?$/)
  if (!match) return false
  if (match[2] && match[2] !== proto) return false
  return match[1]!.split(',').some((part) => {
    const [start, end] = part.split(':').map(Number)
    return end === undefined ? start === port : port >= start! && port <= end
  })
}

export function isSshRule(to: string): boolean {
  return to === 'OpenSSH' || ruleCoversPort(to, 22, 'tcp')
}

export function formatBytes(bytes: number, digits = 1): string {
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${units[unit]}`
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}
