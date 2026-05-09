<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { Project } from '@/views/PortfolioView.vue'
import type { UE } from '@/views/PortfolioView.vue'

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++',
  'PHP', 'Kotlin', 'Assembly', 'C', 'Vue', 'React', 'Angular',
  'Bash', 'HTML/CSS', 'SQL',
]

const props = defineProps<{
  project: Project | null
  ues: UE[]
  projects: Project[]
}>()

const emit = defineEmits<{
  submitCreate: [project: Project]
  submitUpdate: [project: Project]
  cancel: []
}>()

const isEdit = computed(() => props.project !== null)

const empty = (): Project => ({
  id: '',
  projectType: 'Personal',
  title: '',
  description: '',
  image: '',
  liveDemoLink: '',
  sourceCodeLink: '',
  competences: [],
  programmingLanguages: [],
})

const form = ref<Project>(props.project ? { ...props.project } : empty())

watch(() => props.project, (val) => {
  form.value = val ? { ...val } : empty()
})

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

watch(() => form.value.title, (val) => {
  if (!isEdit.value) {
    form.value.id = slugify(val)
  }
})

const idCollision = computed(() => {
  if (isEdit.value) return false
  return props.projects.some(p => p.id === form.value.id)
})

const ueOptions = computed(() =>
  props.ues.map(u => ({ label: u.name, value: u.id }))
)

const projectTypeOptions = [
  { label: 'Personal', value: 'Personal' },
  { label: 'Academic', value: 'Academic' },
]

const valid = computed(() =>
  form.value.id.trim() !== '' &&
  form.value.title.trim() !== '' &&
  form.value.description.trim() !== '' &&
  !idCollision.value
)

function handleSubmit() {
  if (!valid.value) return
  if (isEdit.value) emit('submitUpdate', { ...form.value })
  else emit('submitCreate', { ...form.value })
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="isEdit ? 'Modifier le projet' : 'Nouveau projet'"
    :style="{ width: '560px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>Titre</label>
        <InputText v-model="form.title" placeholder="Mon Projet" fluid />
      </div>

      <div class="field">
        <label>ID</label>
        <InputText v-model="form.id" :disabled="isEdit" fluid />
        <Message v-if="idCollision" severity="error" size="small">
          Cet ID existe déjà
        </Message>
      </div>

      <div class="field">
        <label>Type</label>
        <SelectButton
          v-model="form.projectType"
          :options="projectTypeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" rows="4" fluid />
      </div>

      <div class="field">
        <label>Image (nom du fichier)</label>
        <InputText v-model="form.image" placeholder="mon-projet.png" fluid />
      </div>

      <div class="field">
        <label>Live demo</label>
        <InputText v-model="form.liveDemoLink" placeholder="https://..." fluid />
      </div>

      <div class="field">
        <label>Source code</label>
        <InputText v-model="form.sourceCodeLink" placeholder="https://github.com/..." fluid />
      </div>

      <div class="field">
        <label>Langages</label>
        <MultiSelect
          v-model="form.programmingLanguages"
          :options="LANGUAGES"
          placeholder="Sélectionner des langages"
          display="chip"
          fluid
        />
      </div>

      <div class="field">
        <label>Compétences</label>
        <MultiSelect
          v-model="form.competences"
          :options="ueOptions"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner des compétences"
          display="chip"
          fluid
        />
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

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>