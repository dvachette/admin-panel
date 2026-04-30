<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import ContainerTable from '@/components/docker/ContainerTable.vue'
import { useDockerService } from '@/services/dockerService'
import type { Container } from '@/types/dockerTypes'



const toast = useToast()
const dockerService = useDockerService()
const containers = ref<Container[]>([])
const loading = ref(false)

async function handleRemove(id: string) {
  try {
    await dockerService.deleteContainer(id)
    await fetchContainers()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de supprimer le conteneur',
      life: 3000,
    })
  }
}

async function fetchContainers() {
  loading.value = true
  try {
    const { data } = await dockerService.getContainers()
    containers.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de récupérer les conteneurs',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

async function handleStart(id: string) {
  try {
    await dockerService.startContainer(id)
    await fetchContainers()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de démarrer le conteneur',
      life: 3000,
    })
  }
}

async function handleStop(id: string) {
  try {
    await dockerService.stopContainer(id)
    await fetchContainers()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de stopper le conteneur',
      life: 3000,
    })
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
      @remove="handleRemove"
    />
  </div>
</template>
