<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { ruleCoversPort, type FirewallStatus, type ListeningPort } from '@/types/systemTypes'
import { isPubliclyExposed, type Container } from '@/types/dockerTypes'

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary'

interface Exposure {
  key: string
  proto: 'tcp' | 'udp'
  port: number
  addresses: string[]
  container: string | null
  label: string
  severity: Severity
  detail: string
}

const props = defineProps<{
  ports: ListeningPort[]
  firewall: FirewallStatus | null
  containers: Container[]
}>()

/** Containers publishing a port on every interface: Docker's iptables rules bypass ufw */
const dockerPublished = computed(() => {
  const map = new Map<string, string>()
  for (const c of props.containers) {
    for (const p of c.ports) {
      if (p.publicPort !== undefined && isPubliclyExposed(p)) map.set(`${p.type}/${p.publicPort}`, c.name)
    }
  }
  return map
})

function classify(proto: 'tcp' | 'udp', port: number, container: string | null): Pick<Exposure, 'label' | 'severity' | 'detail'> {
  if (container) {
    return {
      label: 'Exposé (Docker)',
      severity: 'danger',
      detail: `Publié par ${container} : Docker contourne ufw. Liez-le à 127.0.0.1 et passez par nginx.`,
    }
  }
  const fw = props.firewall
  if (!fw) return { label: '?', severity: 'secondary', detail: 'État du pare-feu inconnu' }
  if (!fw.active) return { label: 'Exposé', severity: 'danger', detail: 'ufw est inactif' }
  const rules = fw.rules.filter(
    (r) => r.action.endsWith(' IN') && ruleCoversPort(r.to, port, proto),
  )
  const allow = rules.find((r) => /^(ALLOW|LIMIT)/.test(r.action) && r.from === 'Anywhere')
  if (allow) return { label: 'Ouvert', severity: 'info', detail: `Autorisé par « ${allow.to} »` }
  const restricted = rules.find((r) => /^(ALLOW|LIMIT)/.test(r.action))
  if (restricted) return { label: 'Restreint', severity: 'success', detail: `Autorisé depuis ${restricted.from}` }
  const policy = fw.defaults?.incoming
  if (policy === 'deny' || policy === 'reject' || rules.length > 0) {
    return { label: 'Bloqué', severity: 'secondary', detail: 'Aucune règle ne l’autorise' }
  }
  return { label: 'Exposé', severity: 'danger', detail: `Politique entrante : ${policy ?? '?'}` }
}

const SEVERITY_ORDER: Severity[] = ['danger', 'info', 'success', 'secondary', 'warn']

const exposures = computed<Exposure[]>(() => {
  const byPort = new Map<string, Exposure>()
  for (const p of props.ports) {
    if (p.loopback) continue
    const key = `${p.proto}/${p.port}`
    const entry = byPort.get(key)
    if (entry) {
      if (!entry.addresses.includes(p.address)) entry.addresses.push(p.address)
      continue
    }
    const container = dockerPublished.value.get(key) ?? null
    byPort.set(key, { key, proto: p.proto, port: p.port, addresses: [p.address], container, ...classify(p.proto, p.port, container) })
  }
  // Without Docker's userland proxy, published ports do not show up in `ss`: add them anyway
  for (const [key, container] of dockerPublished.value) {
    if (byPort.has(key)) continue
    const [proto, port] = key.split('/') as ['tcp' | 'udp', string]
    byPort.set(key, { key, proto, port: Number(port), addresses: ['0.0.0.0'], container, ...classify(proto, Number(port), container) })
  }
  return [...byPort.values()].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.port - b.port,
  )
})

const showBlocked = ref(false)
const blockedCount = computed(() => exposures.value.filter((e) => e.label === 'Bloqué').length)
const visible = computed(() =>
  showBlocked.value ? exposures.value : exposures.value.filter((e) => e.label !== 'Bloqué'),
)

const localOnly = computed(() => new Set(props.ports.filter((p) => p.loopback).map((p) => `${p.proto}/${p.port}`)).size)
</script>

<template>
  <DataTable :value="visible" data-key="key" size="small" striped-rows>
    <template #empty>Aucun port joignable depuis l’extérieur.</template>
    <Column header="Port">
      <template #body="{ data }">
        <span class="mono">{{ data.port }}/{{ data.proto }}</span>
      </template>
    </Column>
    <Column header="Écoute sur">
      <template #body="{ data }">
        <span class="mono text-muted">{{ data.addresses.join(', ') }}</span>
      </template>
    </Column>
    <Column header="Conteneur">
      <template #body="{ data }">{{ data.container ?? '—' }}</template>
    </Column>
    <Column header="Depuis Internet">
      <template #body="{ data }">
        <Tag v-tooltip.top="data.detail" :value="data.label" :severity="data.severity" />
      </template>
    </Column>
  </DataTable>
  <Button
    v-if="blockedCount"
    :label="showBlocked ? 'Masquer les ports bloqués par ufw' : `Afficher les ${blockedCount} port(s) bloqué(s) par ufw`"
    :icon="showBlocked ? 'pi pi-eye-slash' : 'pi pi-eye'"
    size="small"
    text
    class="toggle"
    @click="showBlocked = !showBlocked"
  />
  <small class="text-muted">
    {{ localOnly }} port(s) n’écoutent que sur la boucle locale (127.0.0.1 / ::1) : non joignables
    de l’extérieur.
  </small>
</template>

<style scoped>
.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.text-muted {
  color: var(--p-surface-400);
}

small {
  display: block;
  margin-top: 0.25rem;
}

.toggle {
  margin-top: 0.5rem;
}
</style>
