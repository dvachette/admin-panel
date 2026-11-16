<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { findCoveringCertificate, type Certificate, type VhostConfig } from '@/types/nginxTypes'

const props = defineProps<{
  certificates: Certificate[]
  /** Creation in progress (certbot can take a while) */
  submitting: boolean
}>()

const emit = defineEmits<{
  submit: [cfg: VhostConfig]
  cancel: []
}>()

const form = ref<VhostConfig>({
  name: '',
  serverName: '',
  mode: 'proxy',
  proxyPort: undefined,
  root: undefined,
  ssl: false,
})

const modeOptions = [
  { label: 'Proxy', value: 'proxy' },
  { label: 'Static', value: 'static' },
]

const valid = computed(() => {
  if (!form.value.serverName) return false
  if (form.value.mode === 'proxy' && !form.value.proxyPort) return false
  if (form.value.mode === 'static' && !form.value.root) return false
  return true
})

const coveringCert = computed<Certificate | null>(() => {
  const host = form.value.serverName.trim()
  return host ? findCoveringCertificate(props.certificates, host) : null
})

function handleSubmit() {
  if (!valid.value || props.submitting) return
  const serverName: string = form.value.serverName.trim()
  emit('submit', { ...form.value, serverName, name: serverName })
}
</script>

<template>
  <Dialog
    visible
    modal
    header="Nouveau vhost"
    :style="{ width: '480px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">

      <div class="field">
        <label>Server name</label>
        <InputText v-model="form.serverName" placeholder="mon-site.dvachette.fr" fluid />
      </div>

      <div class="field">
        <label>Mode</label>
        <SelectButton
          v-model="form.mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div v-if="form.mode === 'proxy'" class="field">
        <label>Port cible</label>
        <InputNumber v-model="form.proxyPort" placeholder="3000" fluid />
      </div>

      <div v-if="form.mode === 'static'" class="field">
        <label>Root</label>
        <InputText v-model="form.root" placeholder="/var/www/mon-site" fluid />
      </div>

      <div class="field field--row">
        <label>SSL (Certbot)</label>
        <ToggleSwitch v-model="form.ssl" />
      </div>
      <template v-if="form.ssl && form.serverName.trim()">
        <Message v-if="coveringCert" severity="success" size="small" :closable="false">
          Couvert par le certificat {{ coveringCert.name }} ({{ coveringCert.domains.join(', ') }}) :
          certbot l'installera sur le vhost.
        </Message>
        <Message v-else severity="warn" size="small" :closable="false">
          Aucun certificat ne couvre ce domaine : certbot en demandera un nouveau. Le DNS doit déjà
          pointer vers ce serveur.
        </Message>
        <small class="hint">Le vhost sera activé en HTTP, puis certbot ajoutera HTTPS et la redirection.</small>
      </template>
    </div>

    <template #footer>
      <Button label="Annuler" text :disabled="submitting" @click="emit('cancel')" />
      <Button label="Créer" :disabled="!valid" :loading="submitting" @click="handleSubmit" />
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

.field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.hint {
  color: var(--p-surface-400);
  margin-top: -0.5rem;
}

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>
