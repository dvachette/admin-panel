<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue'
import {
  HEALTH_LABELS,
  isPubliclyExposed,
  shortImage,
  sinceLabel,
  stateTag,
  type Container,
  type ContainerPort,
  type ContainerStats,
} from '@/types/dockerTypes'
import { useDockerService } from '@/services/dockerService'

const STANDALONE = 'Conteneurs isolés'

const confirm = useConfirm()
const dockerService = useDockerService()
const props = defineProps<{
  containers: Container[]
  loading: boolean
  /** Domains of the nginx vhosts proxying to each published port */
  domainsByPort: Record<number, string[]>
  /** Id of the container an action is running on */
  busy: string | null
}>()

const emit = defineEmits<{
  start: [id: string]
  stop: [id: string]
  restart: [id: string]
  remove: [id: string]
  logs: [container: Container]
}>()

interface Row extends Container {
  group: string
}

// Sorted by group (compose project, standalone last) then name, as row grouping requires
const rows = computed<Row[]>(() =>
  props.containers
    .map((c) => ({ ...c, group: c.project ?? STANDALONE }))
    .sort((a, b) => {
      if (a.group !== b.group) {
        if (a.group === STANDALONE) return 1
        if (b.group === STANDALONE) return -1
        return a.group.localeCompare(b.group)
      }
      return (a.service ?? a.name).localeCompare(b.service ?? b.name)
    }),
)

function groupSummary(group: string): string {
  const members = rows.value.filter((r) => r.group === group)
  const running = members.filter((r) => r.state === 'running').length
  return `${running}/${members.length} en marche`
}

function domainsOf(container: Container): string[] {
  const domains = container.ports.flatMap((p) =>
    p.publicPort !== undefined ? (props.domainsByPort[p.publicPort] ?? []) : [],
  )
  return [...new Set(domains)]
}

function portLabel(port: ContainerPort): string {
  const proto = port.type === 'tcp' ? '' : `/${port.type}`
  return port.publicPort !== undefined
    ? `${port.publicPort} → ${port.privatePort}${proto}`
    : `${port.privatePort}${proto} (interne)`
}

function portTooltip(port: ContainerPort): string {
  if (port.publicPort === undefined) return 'Port non publié sur l’hôte'
  if (isPubliclyExposed(port)) {
    return 'Exposé sur toutes les interfaces : joignable depuis Internet, Docker contourne ufw. Préférez 127.0.0.1:port derrière nginx.'
  }
  return `Accessible uniquement depuis ${port.ips.join(', ')}`
}

const stats = ref<Record<string, ContainerStats>>({})
// Containers whose live CPU / RAM is shown, all served by a single SSE connection
const watched = ref<Set<string>>(new Set())
let statsStream: EventSource | null = null

function formatBytes(bytes: number) {
  return bytes >= 1024 ** 3
    ? (bytes / 1024 ** 3).toFixed(2) + ' Go'
    : (bytes / 1024 / 1024).toFixed(1) + ' Mo'
}

function confirmAction(container: Container, action: 'stop' | 'restart' | 'remove') {
  const texts = {
    stop: { message: `Arrêter "${container.name}" ?`, accept: 'Arrêter' },
    restart: { message: `Redémarrer "${container.name}" ?`, accept: 'Redémarrer' },
    remove: {
      message: `Supprimer "${container.name}" ? Le conteneur est effacé, ses volumes nommés sont conservés.`,
      accept: 'Supprimer',
    },
  }[action]
  confirm.require({
    message: texts.message,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: action === 'restart' ? undefined : 'p-button-danger',
    acceptLabel: texts.accept,
    rejectLabel: 'Annuler',
    accept: () => {
      if (action === 'stop') {
        closeStats(container.id)
        emit('stop', container.id)
      } else if (action === 'restart') emit('restart', container.id)
      else emit('remove', container.id)
    },
  })
}

function reconnectStats() {
  statsStream?.close()
  statsStream = null
  if (watched.value.size === 0) return
  const es = dockerService.getStatsStream([...watched.value])
  es.onmessage = (e) => {
    const { id, error, ...data } = JSON.parse(e.data) as ContainerStats & { id: string; error?: boolean }
    if (error) closeStats(id)
    else if (watched.value.has(id)) stats.value[id] = data
  }
  es.onerror = () => {
    // The browser retries by itself; give up if the stream was closed for good
    if (es.readyState === EventSource.CLOSED) {
      watched.value = new Set()
      stats.value = {}
      statsStream = null
    }
  }
  statsStream = es
}

function closeStats(id: string) {
  if (!watched.value.has(id)) return
  watched.value.delete(id)
  delete stats.value[id]
  reconnectStats()
}

function toggleStats(id: string) {
  if (watched.value.has(id)) {
    closeStats(id)
  } else {
    watched.value.add(id)
    reconnectStats()
  }
}

onUnmounted(() => {
  statsStream?.close()
})
</script>

<template>
  <ConfirmDialog />
  <DataTable
    :value="rows"
    :loading="loading"
    row-group-mode="subheader"
    group-rows-by="group"
    data-key="id"
    striped-rows
  >
    <template #groupheader="{ data }">
      <div class="group-header">
        <i :class="data.group === STANDALONE ? 'pi pi-box' : 'pi pi-sitemap'" />
        <strong>{{ data.group }}</strong>
        <span class="text-muted">{{ groupSummary(data.group) }}</span>
      </div>
    </template>

    <Column header="Nom">
      <template #body="{ data }">
        <div>{{ data.service ?? data.name }}</div>
        <small v-if="data.service" class="text-muted">{{ data.name }}</small>
      </template>
    </Column>
    <Column header="Image">
      <template #body="{ data }">
        <span v-tooltip.top="data.image" class="mono">{{ shortImage(data.image) }}</span>
      </template>
    </Column>
    <Column header="État">
      <template #body="{ data }">
        <div class="state">
          <div class="tags">
            <Tag :value="stateTag(data).label" :severity="stateTag(data).severity" />
            <Tag
              v-if="data.health"
              :value="HEALTH_LABELS[data.health as keyof typeof HEALTH_LABELS].label"
              :severity="HEALTH_LABELS[data.health as keyof typeof HEALTH_LABELS].severity"
              icon="pi pi-heart"
            />
          </div>
          <small v-tooltip.top="data.status" class="text-muted">{{ sinceLabel(data) }}</small>
        </div>
      </template>
    </Column>
    <Column header="Ports">
      <template #body="{ data }">
        <div v-if="data.ports.length" class="ports">
          <span
            v-for="port in data.ports"
            :key="`${port.publicPort}-${port.privatePort}-${port.type}`"
            v-tooltip.top="portTooltip(port)"
            class="port mono"
            :class="{ 'port--public': isPubliclyExposed(port) }"
          >
            <i v-if="isPubliclyExposed(port)" class="pi pi-globe" />
            <i v-else-if="port.publicPort !== undefined" class="pi pi-lock" />
            {{ portLabel(port) }}
          </span>
        </div>
        <span v-else class="text-muted">—</span>
      </template>
    </Column>
    <Column header="Domaines">
      <template #body="{ data }">
        <div v-if="domainsOf(data).length" class="domains">
          <a
            v-for="domain in domainsOf(data)"
            :key="domain"
            :href="`https://${domain}`"
            target="_blank"
            rel="noopener"
          >
            {{ domain }}
          </a>
        </div>
        <span v-else class="text-muted">—</span>
      </template>
    </Column>
    <Column header="CPU / RAM">
      <template #body="{ data }">
        <span v-if="stats[data.id]" class="mono">
          {{ stats[data.id]!.cpu }} % · {{ formatBytes(stats[data.id]!.memUsage) }}
        </span>
        <span v-else class="text-muted">—</span>
      </template>
    </Column>
    <Column header="Actions">
      <template #body="{ data }">
        <div class="actions">
          <Button
            v-if="data.state !== 'running'"
            v-tooltip.top="'Démarrer'"
            icon="pi pi-play"
            size="small"
            severity="success"
            text
            :loading="busy === data.id"
            :disabled="busy !== null"
            @click="emit('start', data.id)"
          />
          <template v-else>
            <Button
              v-tooltip.top="'Arrêter'"
              icon="pi pi-stop"
              size="small"
              severity="danger"
              text
              :disabled="busy !== null"
              @click="confirmAction(data, 'stop')"
            />
            <Button
              v-tooltip.top="'Redémarrer'"
              icon="pi pi-replay"
              size="small"
              severity="warn"
              text
              :loading="busy === data.id"
              :disabled="busy !== null"
              @click="confirmAction(data, 'restart')"
            />
          </template>
          <Button
            v-tooltip.top="watched.has(data.id) ? 'Masquer CPU / RAM' : 'Afficher CPU / RAM en direct'"
            :icon="watched.has(data.id) ? 'pi pi-eye-slash' : 'pi pi-chart-bar'"
            size="small"
            text
            :disabled="data.state !== 'running'"
            @click="toggleStats(data.id)"
          />
          <Button
            v-tooltip.top="'Logs'"
            icon="pi pi-align-left"
            size="small"
            text
            @click="emit('logs', data)"
          />
          <!-- wrapper: a disabled button does not trigger its tooltip -->
          <span v-tooltip.top="data.state === 'running' ? 'Arrêtez-le pour le supprimer' : 'Supprimer'">
            <Button
              icon="pi pi-trash"
              size="small"
              severity="danger"
              text
              :disabled="data.state === 'running' || busy !== null"
              @click="confirmAction(data, 'remove')"
            />
          </span>
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.group-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.state {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tags,
.ports,
.domains {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.port {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.port .pi {
  font-size: 0.75rem;
}

.port--public {
  color: var(--p-orange-400);
}

.domains a {
  color: var(--p-primary-300);
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.text-muted {
  color: var(--p-surface-400);
}
</style>
