<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Button from 'primevue/button'
import type { Vhost, VhostUpdate, ProxyPortChange } from '@/types/nginxTypes'

interface ProxyRow {
  from: string
  initialPort: number | null
  port: number | null
}

const TARGET_PORT_REGEX: RegExp = /^[a-z]+:\/\/[^/:]+:(\d+)/

const props = defineProps<{ vhost: Vhost }>()

const emit = defineEmits<{
  submit: [name: string, update: VhostUpdate]
  cancel: []
}>()

function portOf(target: string): number | null {
  const match: RegExpMatchArray | null = target.match(TARGET_PORT_REGEX)
  return match ? Number(match[1]) : null
}

const initialServerName: string = props.vhost.serverNames[0] ?? ''
const canEditServerName: boolean = initialServerName !== ''
const serverName = ref<string>(initialServerName)
const root = ref<string>(props.vhost.root ?? '')
const rows = ref<ProxyRow[]>(
  props.vhost.proxyTargets.map(
    (target: string): ProxyRow => ({
      from: target,
      initialPort: portOf(target),
      port: portOf(target),
    })
  )
)

const domainChanged = computed<boolean>(
  () => canEditServerName && serverName.value.trim() !== initialServerName
)
const sslWarning = computed<boolean>(() => domainChanged.value && props.vhost.ssl)

const valid = computed<boolean>(() => {
  if (canEditServerName && serverName.value.trim() === '') {
    return false
  }
  if (props.vhost.root !== null && root.value.trim() === '') {
    return false
  }
  return rows.value.every(
    (row: ProxyRow): boolean =>
      row.initialPort === null ||
      (row.port !== null && Number.isInteger(row.port) && row.port >= 1 && row.port <= 65535)
  )
})

const update = computed<VhostUpdate>(() => {
  const result: VhostUpdate = {}
  if (domainChanged.value) {
    result.serverName = serverName.value.trim()
  }
  if (props.vhost.root !== null && root.value.trim() !== props.vhost.root) {
    result.root = root.value.trim()
  }
  const changes: ProxyPortChange[] = rows.value
    .filter((row: ProxyRow): boolean => row.port !== null && row.port !== row.initialPort)
    .map((row: ProxyRow): ProxyPortChange => ({ from: row.from, port: row.port as number }))
  if (changes.length > 0) {
    result.proxyChanges = changes
  }
  return result
})

const hasChanges = computed<boolean>(() => Object.keys(update.value).length > 0)

function handleSubmit(): void {
  if (!valid.value || !hasChanges.value) {
    return
  }
  emit('submit', props.vhost.name, update.value)
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="`Modifier ${vhost.name}`"
    :style="{ width: '480px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>Server name</label>
        <InputText v-model="serverName" :disabled="!canEditServerName" fluid />
        <small v-if="domainChanged">
          Le fichier sera renommé en {{ serverName.trim() }}
        </small>
      </div>

      <Message v-if="sslWarning" severity="warn" :closable="false">
        Le certificat actuel ne correspond plus au nouveau domaine. Il faudra en émettre un nouveau.
      </Message>

      <div v-for="row in rows" :key="row.from" class="field">
        <label>Port de {{ row.from }}</label>
        <InputNumber
          v-if="row.initialPort !== null"
          v-model="row.port"
          :use-grouping="false"
          :min="1"
          :max="65535"
          fluid
        />
        <small v-else>Cible sans port numérique : non modifiable ici</small>
      </div>

      <div v-if="vhost.root !== null" class="field">
        <label>Root</label>
        <InputText v-model="root" fluid />
      </div>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="emit('cancel')" />
      <Button label="Enregistrer" :disabled="!valid || !hasChanges" @click="handleSubmit" />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>
