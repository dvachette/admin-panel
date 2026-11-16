<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import axios from 'axios'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import type { Container } from '@/types/dockerTypes'
import { useDockerService } from '@/services/dockerService'

const props = defineProps<{ container: Container }>()
const emit = defineEmits<{ close: [] }>()

const dockerService = useDockerService()
const TAIL_OPTIONS = [100, 200, 500, 1000, 2000]

const tail = ref(200)
const showTimestamps = ref(false)
const logs = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const output = ref<HTMLElement | null>(null)

// Docker prefixes each line with an RFC 3339 timestamp (requested with timestamps=true)
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm

function displayed(): string {
  return showTimestamps.value ? logs.value : logs.value.replace(TIMESTAMP_RE, '')
}

async function load() {
  loading.value = true
  error.value = null
  try {
    logs.value = await dockerService.getLogs(props.container.id, tail.value)
    await nextTick()
    output.value?.scrollTo({ top: output.value.scrollHeight })
  } catch (err) {
    error.value =
      (axios.isAxiosError(err) && err.response?.data?.error) || 'Impossible de lire les logs'
  } finally {
    loading.value = false
  }
}

watch(tail, load)
onMounted(load)
</script>

<template>
  <Dialog
    visible
    modal
    maximizable
    :header="`Logs · ${container.name}`"
    :style="{ width: '90vw', maxWidth: '1100px' }"
    @update:visible="emit('close')"
  >
    <div class="toolbar">
      <div class="inline">
        <label for="tail">Dernières lignes</label>
        <Select v-model="tail" input-id="tail" :options="TAIL_OPTIONS" size="small" />
      </div>
      <div class="inline">
        <ToggleSwitch v-model="showTimestamps" input-id="timestamps" />
        <label for="timestamps">Horodatage</label>
      </div>
      <Button
        label="Rafraîchir"
        icon="pi pi-refresh"
        size="small"
        :loading="loading"
        @click="load"
      />
    </div>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <pre v-else ref="output" class="logs">{{ displayed() || (loading ? '' : 'Aucun log') }}</pre>
  </Dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}

.logs {
  margin: 0;
  height: 60vh;
  overflow: auto;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--p-surface-950);
  color: var(--p-surface-100);
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
