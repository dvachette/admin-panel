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
