<script setup lang="ts">
import axios from 'axios'
import VhostEditForm from '@/components/nginx/VhostEditForm.vue'
import type {
  Certificate,
  Vhost,
  VhostConfig,
  VhostCreateResult,
  VhostUpdate,
  VhostUpdateResult,
} from '@/types/nginxTypes'
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import VhostTable from '@/components/nginx/VhostTable.vue'
import VhostForm from '@/components/nginx/VhostForm.vue'
import { useNginxService } from '@/services/nginxService'

const toast = useToast()
const nginxService = useNginxService()
const status = ref<'active' | 'inactive'>('inactive')
const vhosts = ref<Vhost[]>([])
const showForm = ref(false)
const loading = ref(false)
const editingVhost = ref<Vhost | null>(null)
const certificates = ref<Certificate[]>([])
const creating = ref(false)
const securing = ref<string | null>(null)

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback
  }
  return fallback
}

async function handleUpdate(name: string, update: VhostUpdate): Promise<void> {
  try {
    const result: VhostUpdateResult = await nginxService.updateVhost(name, update)
    editingVhost.value = null
    await fetchVhosts()
    if (result.warnings.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Modifié',
        detail: result.warnings.join(' | '),
        life: 8000,
      })
    } else {
      toast.add({ severity: 'success', summary: 'Modifié', detail: 'Vhost modifié', life: 2000 })
    }
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: errorMessage(error, 'Impossible de modifier le vhost'),
      life: 8000,
    })
  }
}
async function fetchCertificates() {
  try {
    const { data } = await nginxService.getCertificates()
    certificates.value = data
  } catch (error: unknown) {
    toast.add({
      severity: 'warn',
      summary: 'Certificats',
      detail: errorMessage(error, 'Impossible de lister les certificats'),
      life: 5000,
    })
  }
}

async function handleSecure(name: string) {
  securing.value = name
  try {
    const result = await nginxService.secureVhost(name)
    await Promise.all([fetchVhosts(), fetchCertificates()])
    toast.add({
      severity: 'success',
      summary: 'HTTPS',
      detail: result.issued
        ? `Nouveau certificat ${result.certName} émis et installé`
        : `Certificat ${result.certName} installé`,
      life: 4000,
    })
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: errorMessage(error, "Impossible d'installer le certificat"),
      life: 10000,
    })
  } finally {
    securing.value = null
  }
}

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

async function handleCreate(cfg: VhostConfig) {
  creating.value = true
  try {
    const result: VhostCreateResult = await nginxService.createVhost(cfg)
    showForm.value = false
    await Promise.all([fetchVhosts(), cfg.ssl ? fetchCertificates() : Promise.resolve()])
    if (result.warnings.length > 0) {
      toast.add({ severity: 'warn', summary: 'Créé', detail: result.warnings.join(' | '), life: 10000 })
    } else {
      toast.add({
        severity: 'success',
        summary: 'Créé',
        detail: result.secured ? 'Vhost créé et passé en HTTPS' : 'Vhost créé',
        life: 3000,
      })
    }
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: errorMessage(error, 'Impossible de créer le vhost'),
      life: 8000,
    })
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  fetchStatus()
  fetchVhosts()
  fetchCertificates()
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
      :certificates="certificates"
      :securing="securing"
      @secure="handleSecure"
      @enable="handleEnable"
      @disable="handleDisable"
      @delete="handleDelete"
      @edit="editingVhost = $event"
    />

    <VhostForm
      v-if="showForm"
      :certificates="certificates"
      :submitting="creating"
      @submit="handleCreate"
      @cancel="showForm = false"
    />
    <VhostEditForm
      v-if="editingVhost"
      :vhost="editingVhost"
      :certificates="certificates"
      @submit="handleUpdate"
      @cancel="editingVhost = null"
    />
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
