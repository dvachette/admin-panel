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
import axios from 'axios'

const LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'C#',
  'C++',
  'PHP',
  'Kotlin',
  'Assembly',
  'C',
  'Vue',
  'React',
  'Angular',
  'Bash',
  'HTML/CSS',
  'SQL',
]

const props = defineProps<{
  project: Project | null
  ues: UE[]
  projects: Project[]
  images: string[]
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

watch(
  () => props.project,
  (val) => {
    form.value = val ? { ...val } : empty()
  },
)

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

watch(
  () => form.value.title,
  (val) => {
    if (!isEdit.value) {
      form.value.id = slugify(val)
    }
  },
)

const idCollision = computed(() => {
  if (isEdit.value) return false
  return props.projects.some((p) => p.id === form.value.id)
})

const ueOptions = computed(() => props.ues.map((u) => ({ label: u.name, value: u.id })))

const projectTypeOptions = [
  { label: 'Personal', value: 'Personal' },
  { label: 'Academic', value: 'Academic' },
]

const valid = computed(
  () =>
    form.value.id.trim() !== '' &&
    form.value.title.trim() !== '' &&
    form.value.description.trim() !== '' &&
    !idCollision.value,
)

const uploading = ref(false)

function handleSubmit() {
  if (!valid.value) return
  if (isEdit.value) emit('submitUpdate', { ...form.value })
  else emit('submitCreate', { ...form.value })
}

async function handleImageUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await axios.post('/api/portfolio/images', formData, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    form.value.image = data.filename
  } catch {
    // handle error
  } finally {
    uploading.value = false
  }
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
        <Message v-if="idCollision" severity="error" size="small"> Cet ID existe déjà </Message>
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
        <label>Image</label>
        <Select v-model="form.image" :options="images" placeholder="Sélectionner une image" fluid />
        <div class="upload-row">
          <label class="upload-label">
            <input type="file" accept=".png,.jpg,.jpeg,.webp" hidden @change="handleImageUpload" />
            <Button
              label="Uploader une nouvelle image"
              icon="pi pi-upload"
              size="small"
              text
              :loading="uploading"
              as="span"
            />
          </label>
        </div>
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

.upload-row {
  margin-top: 0.25rem;
}

.upload-label {
  cursor: pointer;
}
</style>
