<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'
import ContainerTable from '@/modules/docker/ContainerTable.vue'

export interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
}

const toast = useToast()
const containers = ref<Container[]>([])
const loading = ref(false)

async function fetchContainers() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/docker/containers', { withCredentials: true })
    containers.value = data
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de récupérer les conteneurs', life: 3000 })
  } finally {
    loading.value = false
  }
}

async function handleStart(id: string) {
  try {
    await axios.post(`/api/docker/containers/${id}/start`, {}, { withCredentials: true })
    await fetchContainers()
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de démarrer le conteneur', life: 3000 })
  }
}

async function handleStop(id: string) {
  try {
    await axios.post(`/api/docker/containers/${id}/stop`, {}, { withCredentials: true })
    await fetchContainers()
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de stopper le conteneur', life: 3000 })
  }
}

onMounted(fetchContainers)
</script>

<template>
  <div>
    <h2>Docker</h2>
    <ContainerTable
      :containers="containers"
      :loading="loading"
      @start="handleStart"
      @stop="handleStop"
    />
  </div>
</template>