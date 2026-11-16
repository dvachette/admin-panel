<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { slugify, type Interest } from '@/types/portfolioTypes'

const props = defineProps<{
  interest: Interest | null
  interests: Interest[]
}>()

const emit = defineEmits<{
  submitCreate: [interest: Interest]
  submitUpdate: [interest: Interest]
  cancel: []
}>()

const isEdit = computed(() => props.interest !== null)

const empty = (): Interest => ({
  id: '',
  title: '',
  icon: '',
  description: '',
  tags: [],
})

const clone = (i: Interest | null): Interest => (i ? { ...i, tags: [...i.tags] } : empty())

const form = ref<Interest>(clone(props.interest))

watch(
  () => props.interest,
  (val) => {
    form.value = clone(val)
  },
)

watch(
  () => form.value.title,
  (val) => {
    if (!isEdit.value) form.value.id = slugify(val)
  },
)

const idCollision = computed(
  () => !isEdit.value && props.interests.some((i) => i.id === form.value.id),
)

const valid = computed(
  () =>
    form.value.id.trim() !== '' &&
    form.value.title.trim() !== '' &&
    form.value.icon.trim() !== '' &&
    form.value.description.trim() !== '' &&
    !idCollision.value,
)

function handleSubmit() {
  if (!valid.value) return
  const interest: Interest = {
    id: form.value.id.trim(),
    title: form.value.title.trim(),
    icon: form.value.icon.trim(),
    description: form.value.description.trim(),
    tags: form.value.tags.map((t) => t.trim()).filter(Boolean),
  }
  if (isEdit.value) emit('submitUpdate', interest)
  else emit('submitCreate', interest)
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="isEdit ? 'Modifier le centre d’intérêt' : 'Nouveau centre d’intérêt'"
    :style="{ width: '520px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>Titre</label>
        <InputText v-model="form.title" placeholder="Open source" fluid />
      </div>

      <div class="field">
        <label>ID</label>
        <InputText v-model="form.id" :disabled="isEdit" fluid />
        <Message v-if="idCollision" severity="error" size="small"> Cet ID existe déjà </Message>
      </div>

      <div class="field">
        <label>Icône (URL d’un SVG)</label>
        <div class="icon-row">
          <InputText
            v-model="form.icon"
            placeholder="https://unpkg.com/lucide-static@latest/icons/globe.svg"
            fluid
          />
          <img v-if="form.icon" :src="form.icon" alt="" class="icon-preview" />
        </div>
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" rows="4" fluid />
      </div>

      <div class="field">
        <label>Tags (Entrée pour ajouter)</label>
        <AutoComplete v-model="form.tags" multiple :typeahead="false" fluid />
      </div>
    </div>

    <template #footer>
      <Button label="Annuler" text @click="emit('cancel')" />
      <Button :label="isEdit ? 'Modifier' : 'Créer'" :disabled="!valid" @click="handleSubmit" />
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

.icon-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-preview {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  filter: invert(1);
}

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>
