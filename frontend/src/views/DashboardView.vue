<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import MetricSparkline from '@/components/dashboard/MetricSparkline.vue'
import FirewallPanel from '@/components/dashboard/FirewallPanel.vue'
import ExposurePanel from '@/components/dashboard/ExposurePanel.vue'
import { useSystemService } from '@/services/systemService'
import { useDockerService } from '@/services/dockerService'
import { useNginxService } from '@/services/nginxService'
import {
  formatBytes,
  formatDuration,
  groupRules,
  type FirewallStatus,
  type ListeningPort,
  type NewRule,
  type RuleGroup,
  type SystemMetrics,
} from '@/types/systemTypes'
import type { Container } from '@/types/dockerTypes'
import type { Certificate } from '@/types/nginxTypes'

const METRICS_INTERVAL_MS = 3_000
const SLOW_INTERVAL_MS = 30_000

const toast = useToast()
const systemService = useSystemService()
const dockerService = useDockerService()
const nginxService = useNginxService()

const metrics = ref<SystemMetrics | null>(null)
const metricsError = ref<string | null>(null)
const firewall = ref<FirewallStatus | null>(null)
const firewallError = ref<string | null>(null)
const firewallBusy = ref(false)
const ports = ref<ListeningPort[]>([])
const containers = ref<Container[]>([])
const nginxStatus = ref<'active' | 'inactive' | null>(null)
const certificates = ref<Certificate[]>([])

function errorMessage(err: unknown, fallback: string): string {
  return (axios.isAxiosError(err) && err.response?.data?.error) || fallback
}

// ------------------------------------------------------------------ data

async function fetchMetrics() {
  try {
    metrics.value = await systemService.getMetrics()
    metricsError.value = null
  } catch (err) {
    metricsError.value = errorMessage(err, 'Impossible de lire les métriques')
  }
}

async function fetchFirewall() {
  try {
    firewall.value = await systemService.getFirewall()
    firewallError.value = null
  } catch (err) {
    firewallError.value = errorMessage(err, 'Impossible de lire l’état d’ufw')
  }
}

async function fetchSlow() {
  const [portsResult, containersResult, statusResult, certsResult] = await Promise.allSettled([
    systemService.getListeningPorts(),
    dockerService.getContainers(),
    nginxService.getStatus(),
    nginxService.getCertificates(),
  ])
  if (portsResult.status === 'fulfilled') ports.value = portsResult.value
  if (containersResult.status === 'fulfilled') containers.value = containersResult.value.data
  nginxStatus.value = statusResult.status === 'fulfilled' ? statusResult.value.data.status : null
  if (certsResult.status === 'fulfilled') certificates.value = certsResult.value.data
  await fetchFirewall()
}

async function handleAddRule(rule: NewRule) {
  firewallBusy.value = true
  try {
    firewall.value = await systemService.addFirewallRule(rule)
    toast.add({ severity: 'success', summary: 'Pare-feu', detail: 'Règle ajoutée', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Pare-feu', detail: errorMessage(err, 'Impossible d’ajouter la règle'), life: 6000 })
  } finally {
    firewallBusy.value = false
  }
}

async function handleDeleteRule(group: RuleGroup) {
  firewallBusy.value = true
  try {
    firewall.value = await systemService.deleteFirewallRules(group.rules)
    toast.add({ severity: 'success', summary: 'Pare-feu', detail: 'Règle supprimée', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Pare-feu', detail: errorMessage(err, 'Impossible de supprimer la règle'), life: 6000 })
    await fetchFirewall()
  } finally {
    firewallBusy.value = false
  }
}

// ------------------------------------------------------------------ polling (paused when the tab is hidden)

let metricsTimer: ReturnType<typeof setInterval> | null = null
let slowTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  metricsTimer = setInterval(fetchMetrics, METRICS_INTERVAL_MS)
  slowTimer = setInterval(fetchSlow, SLOW_INTERVAL_MS)
}

function stopPolling() {
  if (metricsTimer) clearInterval(metricsTimer)
  if (slowTimer) clearInterval(slowTimer)
  metricsTimer = slowTimer = null
}

function onVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else {
    fetchMetrics()
    fetchSlow()
    startPolling()
  }
}

onMounted(() => {
  fetchMetrics()
  fetchSlow()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// ------------------------------------------------------------------ derived values

const current = computed(() => metrics.value?.current ?? null)
const history = computed(() => metrics.value?.history ?? [])
const cpuHistory = computed(() => history.value.map((s) => s.cpuPercent))
const memHistory = computed(() => history.value.map((s) => (s.memTotal ? (s.memUsed / s.memTotal) * 100 : 0)))
const rxHistory = computed(() => history.value.map((s) => s.netRx))
const txHistory = computed(() => history.value.map((s) => s.netTx))
const netMax = computed(() => Math.max(1, ...rxHistory.value, ...txHistory.value))

const memPercent = computed(() =>
  current.value && current.value.memTotal ? Math.round((current.value.memUsed / current.value.memTotal) * 100) : 0,
)

function percentSeverityColor(percent: number): string {
  if (percent >= 90) return 'var(--p-red-400)'
  if (percent >= 75) return 'var(--p-orange-400)'
  return 'var(--p-primary-400)'
}

const running = computed(() => containers.value.filter((c) => c.state === 'running').length)
const unhealthy = computed(() => containers.value.filter((c) => c.health === 'unhealthy'))
const crashed = computed(() =>
  containers.value.filter((c) => /^Exited \((?!0\)|143\))\d+\)/.test(c.status)),
)

const nextCertificate = computed(() =>
  [...certificates.value]
    .filter((c) => c.daysLeft !== null)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0] ?? null,
)

const dockerExposed = computed(() =>
  containers.value.flatMap((c) =>
    c.ports.filter((p) => p.publicPort !== undefined && p.ips.some((ip) => ip === '0.0.0.0' || ip === '::')),
  ).length,
)
</script>

<template>
  <div class="dashboard">
    <div class="header">
      <div>
        <h2>Dashboard</h2>
        <small v-if="metrics" class="text-muted">
          {{ metrics.host.hostname }} · {{ metrics.host.os }} · noyau {{ metrics.host.kernel }} ·
          en ligne depuis {{ formatDuration(metrics.host.uptime) }}
        </small>
      </div>
      <Button
        label="Rafraîchir"
        icon="pi pi-refresh"
        size="small"
        @click="fetchMetrics(); fetchSlow()"
      />
    </div>

    <p v-if="metricsError" class="error">{{ metricsError }}</p>

    <!-- System metrics -->
    <section class="grid">
      <div class="card">
        <div class="card-title"><i class="pi pi-microchip" /> CPU</div>
        <div class="big">{{ current ? `${current.cpuPercent.toFixed(1)} %` : '—' }}</div>
        <small class="text-muted" v-if="metrics">
          {{ metrics.host.cpus }} cœurs · charge {{ metrics.host.load.map((l) => l.toFixed(2)).join(' / ') }}
        </small>
        <MetricSparkline :values="cpuHistory" :max="100" :color="percentSeverityColor(current?.cpuPercent ?? 0)" label="CPU sur 5 minutes" />
      </div>

      <div class="card">
        <div class="card-title"><i class="pi pi-server" /> Mémoire</div>
        <div class="big">{{ current ? `${memPercent} %` : '—' }}</div>
        <small class="text-muted" v-if="current">
          {{ formatBytes(current.memUsed) }} / {{ formatBytes(current.memTotal) }}
          <template v-if="current.swapTotal"> · swap {{ formatBytes(current.swapUsed) }} / {{ formatBytes(current.swapTotal) }}</template>
          <template v-else> · pas de swap</template>
        </small>
        <MetricSparkline :values="memHistory" :max="100" :color="percentSeverityColor(memPercent)" label="Mémoire sur 5 minutes" />
      </div>

      <div class="card">
        <div class="card-title"><i class="pi pi-arrow-right-arrow-left" /> Réseau</div>
        <div class="net">
          <span><i class="pi pi-arrow-down rx" /> {{ current ? `${formatBytes(current.netRx)}/s` : '—' }}</span>
          <span><i class="pi pi-arrow-up tx" /> {{ current ? `${formatBytes(current.netTx)}/s` : '—' }}</span>
        </div>
        <small class="text-muted">interfaces physiques, hors Docker</small>
        <div class="stacked">
          <MetricSparkline :values="rxHistory" :max="netMax" color="var(--p-cyan-400)" label="Réception sur 5 minutes" />
          <MetricSparkline :values="txHistory" :max="netMax" color="var(--p-purple-400)" label="Émission sur 5 minutes" />
        </div>
      </div>

      <div class="card">
        <div class="card-title"><i class="pi pi-database" /> Disques</div>
        <div v-for="disk in metrics?.disks ?? []" :key="disk.mount" class="disk">
          <div class="disk-line">
            <span class="mono">{{ disk.mount }}</span>
            <span class="text-muted">{{ formatBytes(disk.available) }} libres / {{ formatBytes(disk.total) }}</span>
          </div>
          <ProgressBar
            :value="Math.round((disk.used / disk.total) * 100)"
            :show-value="false"
            class="disk-bar"
            :pt="{ value: { style: { background: percentSeverityColor((disk.used / disk.total) * 100) } } }"
          />
        </div>
      </div>
    </section>

    <!-- Services -->
    <section class="grid services">
      <div class="card">
        <div class="card-title"><i class="pi pi-box" /> Conteneurs</div>
        <div class="big">{{ running }} / {{ containers.length }}</div>
        <small class="text-muted">en marche</small>
        <div class="tags">
          <Tag v-if="unhealthy.length" v-tooltip.top="unhealthy.map((c) => c.name).join(', ')" :value="`${unhealthy.length} malade(s)`" severity="danger" />
          <Tag v-if="crashed.length" v-tooltip.top="crashed.map((c) => c.name).join(', ')" :value="`${crashed.length} planté(s)`" severity="danger" />
          <Tag v-if="dockerExposed" :value="`${dockerExposed} port(s) exposé(s)`" severity="warn" />
          <RouterLink to="/docker" class="link">Voir</RouterLink>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><i class="pi pi-globe" /> Nginx</div>
        <Tag
          :value="nginxStatus === null ? 'inconnu' : nginxStatus === 'active' ? 'actif' : 'arrêté'"
          :severity="nginxStatus === 'active' ? 'success' : 'danger'"
        />
        <div v-if="nextCertificate" class="cert">
          <small class="text-muted">Prochaine expiration</small>
          <div>
            <span class="mono">{{ nextCertificate.name }}</span>
            <Tag
              :value="`${nextCertificate.daysLeft} j`"
              :severity="(nextCertificate.daysLeft ?? 0) < 0 ? 'danger' : (nextCertificate.daysLeft ?? 0) < 20 ? 'warn' : 'success'"
            />
          </div>
        </div>
        <small v-else class="text-muted">Aucun certificat Let’s Encrypt</small>
        <RouterLink to="/nginx" class="link">Voir</RouterLink>
      </div>

      <div class="card">
        <div class="card-title"><i class="pi pi-shield" /> Pare-feu</div>
        <Tag
          :value="firewallError ? 'indisponible' : !firewall ? '…' : firewall.active ? 'actif' : 'inactif'"
          :severity="firewall?.active ? 'success' : 'danger'"
        />
        <small v-if="firewall?.active" class="text-muted">
          {{ groupRules(firewall.rules).length }} règle(s) · entrant par défaut : {{ firewall.defaults?.incoming }}
        </small>
      </div>
    </section>

    <!-- Firewall and exposure -->
    <section class="columns">
      <div class="card">
        <div class="card-title"><i class="pi pi-shield" /> Règles ufw</div>
        <FirewallPanel
          :firewall="firewall"
          :error="firewallError"
          :busy="firewallBusy"
          @add="handleAddRule"
          @delete="handleDeleteRule"
        />
      </div>
      <div class="card">
        <div class="card-title"><i class="pi pi-eye" /> Ports joignables</div>
        <ExposurePanel :ports="ports" :firewall="firewall" :containers="containers" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.header h2 {
  margin: 0 0 0.25rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 1rem;
  align-items: start;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--p-surface-700);
  border-radius: 10px;
  background: var(--p-surface-800);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--p-surface-200);
}

.big {
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.net {
  display: flex;
  gap: 1.25rem;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.rx {
  color: var(--p-cyan-400);
}

.tx {
  color: var(--p-purple-400);
}

.stacked {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.disk {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.disk-line {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.disk-bar {
  height: 0.5rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.cert div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.link {
  color: var(--p-primary-300);
  font-size: 0.875rem;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.text-muted {
  color: var(--p-surface-400);
}

.error {
  color: var(--p-red-400);
}

.services .card .p-tag {
  align-self: flex-start;
}
</style>
