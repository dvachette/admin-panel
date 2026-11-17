import axios from 'axios'
import type {
  FirewallRule,
  FirewallStatus,
  ListeningPort,
  NewRule,
  SystemMetrics,
} from '@/types/systemTypes'

async function getMetrics(): Promise<SystemMetrics> {
  const { data } = await axios.get<SystemMetrics>('/api/system/metrics', { withCredentials: true })
  return data
}

async function getListeningPorts(): Promise<ListeningPort[]> {
  const { data } = await axios.get<ListeningPort[]>('/api/system/ports', { withCredentials: true })
  return data
}

async function getFirewall(): Promise<FirewallStatus> {
  const { data } = await axios.get<FirewallStatus>('/api/system/firewall', { withCredentials: true })
  return data
}

async function addFirewallRule(rule: NewRule): Promise<FirewallStatus> {
  const { data } = await axios.post<FirewallStatus>('/api/system/firewall/rules', rule, {
    withCredentials: true,
  })
  return data
}

/** Deletes rules after the backend checked they did not change (number + text) */
async function deleteFirewallRules(rules: FirewallRule[]): Promise<FirewallStatus> {
  const { data } = await axios.post<FirewallStatus>(
    '/api/system/firewall/rules/delete',
    { rules: rules.map((r) => ({ number: r.number, text: r.text })) },
    { withCredentials: true },
  )
  return data
}

export function useSystemService() {
  return { getMetrics, getListeningPorts, getFirewall, addFirewallRule, deleteFirewallRules }
}
