<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ContainerTable from '@/components/docker/ContainerTable.vue'
import ContainerLogs from '@/components/docker/ContainerLogs.vue'
import { useDockerService } from '@/services/dockerService'
import { useNginxService } from '@/services/nginxService'
import type { Container } from '@/types/dockerTypes'
import type { Vhost } from '@/types/nginxTypes'

const toast = useToast()
const dockerService = useDockerService()
const nginxService = useNginxService()
const containers = ref<Container[]>([])
const vhosts = ref<Vhost[]>([])
const loading = ref(false)
const busy = ref<string | null>(null)
const logsContainer = ref<Container | null>(null)

function errorMessage(err: unknown, fallback: string): string {
  return (axios.isAxiosError(err) && err.response?.data?.error) || fallback
}

/** Enabled vhosts proxying to localhost:<port>, by port */
const domainsByPort = computed<Record<number, string[]>>(() => {
  const map: Record<number, string[]> = {}
  for (const vhost of vhosts.value) {
    if (!vhost.enabled) continue
    for (const port of vhost.proxyPorts) {
      map[port] = [...(map[port] ?? []), ...vhost.serverNames.filter((d) => d !== '_')]
    }
  }
  return map
})

async function fetchContainers() {
  loading.value = true
  try {
    const { data } = await dockerService.getContainers()
    containers.value = data
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: errorMessage(err, 'Impossible de récupérer les conteneurs'),
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

async function fetchVhosts() {
  try {
    const { data } = await nginxService.getVhosts()
    vhosts.value = data
  } catch {
    // Domains column only: the page works without nginx
    vhosts.value = []
  }
}

async function runAction(id: string, action: () => Promise<void>, success: string, failure: string) {
  busy.value = id
  try {
    await action()
    await fetchContainers()
    toast.add({ severity: 'success', summary: 'OK', detail: success, life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: errorMessage(err, failure), life: 5000 })
  } finally {
    busy.value = null
  }
}

const nameOf = (id: string) => containers.value.find((c) => c.id === id)?.name ?? id

const handleStart = (id: string) =>
  runAction(id, () => dockerService.startContainer(id), `${nameOf(id)} démarré`, 'Impossible de démarrer le conteneur')
const handleStop = (id: string) =>
  runAction(id, () => dockerService.stopContainer(id), `${nameOf(id)} arrêté`, 'Impossible d’arrêter le conteneur')
const handleRestart = (id: string) =>
  runAction(id, () => dockerService.restartContainer(id), `${nameOf(id)} redémarré`, 'Impossible de redémarrer le conteneur')
const handleRemove = (id: string) =>
  runAction(id, () => dockerService.deleteContainer(id), `${nameOf(id)} supprimé`, 'Impossible de supprimer le conteneur')

onMounted(() => {
  fetchContainers()
  fetchVhosts()
})
</script>

<template>
  <div>
    <div class="header">
      <h2>Docker</h2>
      <Button
        label="Rafraîchir"
        icon="pi pi-refresh"
        size="small"
        :loading="loading"
        @click="fetchContainers(); fetchVhosts()"
      />
    </div>
    <ContainerTable
      :containers="containers"
      :loading="loading"
      :domains-by-port="domainsByPort"
      :busy="busy"
      @start="handleStart"
      @stop="handleStop"
      @restart="handleRestart"
      @remove="handleRemove"
      @logs="logsContainer = $event"
    />
    <ContainerLogs v-if="logsContainer" :container="logsContainer" @close="logsContainer = null" />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
</style>
