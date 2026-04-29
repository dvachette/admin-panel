<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue'
import type { Container } from '@/views/DockerView.vue'

interface Stats {
  cpu: number
  memUsage: number
  memLimit: number
  memPercent: number
}

const confirm = useConfirm()

// eslint-disable-next-line
const props = defineProps<{
  containers: Container[]
  loading: boolean
}>()

const emit = defineEmits<{
  start: [id: string]
  stop: [id: string]
  remove: [id: string]
}>()

const stats = ref<Record<string, Stats>>({})
const sseMap = ref<Record<string, EventSource>>({})

function formatBytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function confirmRemove(id: string) {
  confirm.require({
    message: 'Supprimer ce conteneur ?',
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('remove', id),
  })
}

function openStats(id: string) {
  if (sseMap.value[id]) return
  const es = new EventSource(`/api/docker/containers/${id}/stats`, { withCredentials: true })
  es.onmessage = (e) => {
    stats.value[id] = JSON.parse(e.data)
  }
  es.onerror = () => {
    es.close()
    delete sseMap.value[id]
  }
  sseMap.value[id] = es
}

function closeStats(id: string) {
  sseMap.value[id]?.close()
  delete sseMap.value[id]
  delete stats.value[id]
}

function toggleStats(id: string) {
  if (sseMap.value[id]) closeStats(id)
  else openStats(id)
}

onUnmounted(() => {
  Object.values(sseMap.value).forEach((es) => es.close())
})
</script>

<template>
  <ConfirmDialog />
  <DataTable :value="containers" :loading="loading" stripedRows>
    <Column field="name" header="Nom" />
    <Column field="image" header="Image" />
    <Column field="state" header="État">
      <template #body="{ data }">
        <Tag :value="data.state" :severity="data.state === 'running' ? 'success' : 'secondary'" />
      </template>
    </Column>
    <Column field="status" header="Status" />
    <Column header="CPU / RAM">
      <template #body="{ data }">
        <span v-if="stats[data.id]">
          {{ stats[data.id]!.cpu }}% · {{ formatBytes(stats[data.id]!.memUsage) }} /
          {{ formatBytes(stats[data.id]!.memLimit) }}
        </span>
        <span v-else class="text-muted">—</span>
      </template>
    </Column>
    <Column header="Ports">
      <template #body="{ data }">
        <span v-if="data.ports.length">
          {{
            data.ports
              .filter((p: any) => p.publicPort)
              .map((p: any) => `${p.publicPort}:${p.privatePort}`)
              .join(', ')
          }}
        </span>
        <span v-else class="text-muted">—</span>
      </template>
    </Column>
    <Column header="Actions">
      <template #body="{ data }">
        <div class="actions">
          <Button
            v-if="data.state !== 'running'"
            icon="pi pi-play"
            size="small"
            severity="success"
            text
            @click="emit('start', data.id)"
          />
          <Button
            v-else
            icon="pi pi-stop"
            size="small"
            severity="danger"
            text
            @click="emit('stop', data.id)"
          />
          <Button
            :icon="sseMap[data.id] ? 'pi pi-eye-slash' : 'pi pi-chart-bar'"
            size="small"
            text
            :disabled="data.state !== 'running'"
            @click="toggleStats(data.id)"
          />
          <Button
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            @click="confirmRemove(data.id)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.25rem;
}

.text-muted {
  color: var(--p-surface-400);
}
</style>
