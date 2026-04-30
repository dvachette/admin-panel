export interface VhostConfig {
  name: string
  serverName: string
  mode: 'proxy' | 'static'
  proxyPort?: number
  root?: string
  ssl: boolean
}
