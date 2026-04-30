<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import type { VhostConfig } from '@/types/nginx.type'

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
  if (!form.value.name || !form.value.serverName) return false
  if (form.value.mode === 'proxy' && !form.value.proxyPort) return false
  if (form.value.mode === 'static' && !form.value.root) return false
  return true
})

function handleSubmit() {
  if (!valid.value) return
  emit('submit', { ...form.value })
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
        <label>Nom du fichier</label>
        <InputText v-model="form.name" placeholder="mon-site" fluid />
      </div>

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
    </div>

    <template #footer>
      <Button label="Annuler" text @click="emit('cancel')" />
      <Button label="Créer" :disabled="!valid" @click="handleSubmit" />
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

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>
