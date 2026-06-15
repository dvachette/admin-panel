<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { Section } from '@/views/PortfolioView.vue'

const props = defineProps<{
  section: Section | null
}>()

const emit = defineEmits<{
  submit: [section: Section]
  cancel: []
}>()

const empty = (): Section => ({
  section: '',
  icon: '',
  skills: [],
})

const form = ref<Section>(props.section ? { ...props.section } : empty())

watch(() => props.section, (val) => {
  form.value = val ? { ...val } : empty()
})

function handleSubmit() {
  if (!form.value.section.trim()) return
  emit('submit', { ...form.value })
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="section ? 'Modifier la section' : 'Nouvelle section'"
    :style="{ width: '420px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>Nom</label>
        <InputText v-model="form.section" placeholder="Registre des compétences" fluid />
      </div>
      <div class="field">
        <label>Icône (URL)</label>
        <InputText v-model="form.icon" placeholder="https://api.iconify.design/..." fluid />
      </div>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="emit('cancel')" />
      <Button
        :label="section ? 'Modifier' : 'Créer'"
        :disabled="!form.section.trim()"
        @click="handleSubmit"
      />
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