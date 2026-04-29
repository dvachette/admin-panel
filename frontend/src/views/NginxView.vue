<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import VhostTable from '@/modules/nginx/VhostTable.vue'
import VhostForm from '@/modules/nginx/VhostForm.vue'

export interface Vhost {
  name: string
  enabled: boolean
}

const toast = useToast()
const status = ref<'active' | 'inactive'>('inactive')
const vhosts = ref<Vhost[]>([])
const showForm = ref(false)
const loading = ref(false)

async function fetchStatus() {
  const { data } = await axios.get('/api/nginx/status', { withCredentials: true })
  status.value = data.status
}

async function fetchVhosts() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/nginx/vhosts', { withCredentials: true })
    vhosts.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de récupérer les vhosts',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

async function handleStart() {
  try {
    await axios.post('/api/nginx/start', {}, { withCredentials: true })
    await fetchStatus()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de démarrer nginx',
      life: 3000,
    })
  }
}

async function handleStop() {
  try {
    await axios.post('/api/nginx/stop', {}, { withCredentials: true })
    await fetchStatus()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de stopper nginx',
      life: 3000,
    })
  }
}

async function handleReload() {
  try {
    await axios.post('/api/nginx/reload', {}, { withCredentials: true })
    toast.add({ severity: 'success', summary: 'Rechargé', detail: 'Nginx rechargé', life: 2000 })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de recharger nginx',
      life: 3000,
    })
  }
}

async function handleEnable(name: string) {
  try {
    await axios.post(`/api/nginx/vhosts/${name}/enable`, {}, { withCredentials: true })
    await fetchVhosts()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: "Impossible d'activer le vhost",
      life: 3000,
    })
  }
}

async function handleDisable(name: string) {
  try {
    await axios.post(`/api/nginx/vhosts/${name}/disable`, {}, { withCredentials: true })
    await fetchVhosts()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de désactiver le vhost',
      life: 3000,
    })
  }
}

async function handleDelete(name: string) {
  try {
    await axios.delete(`/api/nginx/vhosts/${name}`, { withCredentials: true })
    await fetchVhosts()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de supprimer le vhost',
      life: 3000,
    })
  }
}

async function handleCreate(cfg: object) {
  try {
    await axios.post('/api/nginx/vhosts', cfg, { withCredentials: true })
    showForm.value = false
    await fetchVhosts()
    toast.add({ severity: 'success', summary: 'Créé', detail: 'Vhost créé', life: 2000 })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de créer le vhost',
      life: 3000,
    })
  }
}

onMounted(() => {
  fetchStatus()
  fetchVhosts()
})
</script>

<template>
  <div>
    <div class="header">
      <h2>Nginx</h2>
      <div class="controls">
        <Tag :value="status" :severity="status === 'active' ? 'success' : 'danger'" />
        <Button
          v-if="status === 'inactive'"
          label="Démarrer"
          icon="pi pi-play"
          severity="success"
          size="small"
          @click="handleStart"
        />
        <Button
          v-else
          label="Stopper"
          icon="pi pi-stop"
          severity="danger"
          size="small"
          @click="handleStop"
        />
        <Button
          label="Recharger"
          icon="pi pi-refresh"
          size="small"
          :disabled="status !== 'active'"
          @click="handleReload"
        />
        <Button label="Nouveau vhost" icon="pi pi-plus" size="small" @click="showForm = true" />
      </div>
    </div>

    <VhostTable
      :vhosts="vhosts"
      :loading="loading"
      @enable="handleEnable"
      @disable="handleDisable"
      @delete="handleDelete"
    />

    <VhostForm v-if="showForm" @submit="handleCreate" @cancel="showForm = false" />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
