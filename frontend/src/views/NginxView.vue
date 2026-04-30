<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import VhostTable from '@/components/nginx/VhostTable.vue'
import VhostForm from '@/components/nginx/VhostForm.vue'
import type { Vhost } from '@/types/nginx.type'
import { useNginxService } from '@/services/nginxService'

const toast = useToast()
const nginxService = useNginxService()
const status = ref<'active' | 'inactive'>('inactive')
const vhosts = ref<Vhost[]>([])
const showForm = ref(false)
const loading = ref(false)

async function fetchStatus() {
  const { data } = await nginxService.getStatus()
  status.value = data.status
}

async function fetchVhosts() {
  loading.value = true
  try {
    const { data } = await nginxService.getVhosts()
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
    await nginxService.startNginx()
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
    await nginxService.stopNginx()
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
    await nginxService.reloadNginx()
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
    await nginxService.enableVhost(name)
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
    await nginxService.disableVhost(name)
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
    await nginxService.deleteVhost(name)
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
    await nginxService.createVhost(cfg)
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
