<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import type { Project } from '@/views/PortfolioView.vue'

const props = defineProps<{
  project: Project | null
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

const projectTypeOptions = [
  { label: 'Personal', value: 'Personal' },
  { label: 'Academic', value: 'Academic' },
]

const langInput = ref('')
const competenceInput = ref('')

function addLang() {
  const val = langInput.value.trim()
  if (val && !form.value.programmingLanguages.includes(val)) {
    form.value.programmingLanguages.push(val)
  }
  langInput.value = ''
}

function removeLang(lang: string) {
  form.value.programmingLanguages = form.value.programmingLanguages.filter((l) => l !== lang)
}

function addCompetence() {
  const val = competenceInput.value.trim()
  if (val && !form.value.competences.includes(val)) {
    form.value.competences.push(val)
  }
  competenceInput.value = ''
}

function removeCompetence(c: string) {
  form.value.competences = form.value.competences.filter((x) => x !== c)
}

const valid = computed(
  () =>
    form.value.id.trim() !== '' &&
    form.value.title.trim() !== '' &&
    form.value.description.trim() !== '',
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
        <label>ID</label>
        <InputText v-model="form.id" :disabled="isEdit" placeholder="mon-projet" fluid />
      </div>

      <div class="field">
        <label>Titre</label>
        <InputText v-model="form.title" placeholder="Mon Projet" fluid />
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
        <div class="chip-input">
          <InputText
            v-model="langInput"
            placeholder="TypeScript"
            @keydown.enter.prevent="addLang"
            fluid
          />
          <Button icon="pi pi-plus" size="small" @click="addLang" />
        </div>
        <div class="chips">
          <Chip
            v-for="lang in form.programmingLanguages"
            :key="lang"
            :label="lang"
            removable
            @remove="removeLang(lang)"
          />
        </div>
      </div>

      <div class="field">
        <label>Compétences</label>
        <div class="chip-input">
          <InputText
            v-model="competenceInput"
            placeholder="realiser"
            @keydown.enter.prevent="addCompetence"
            fluid
          />
          <Button icon="pi pi-plus" size="small" @click="addCompetence" />
        </div>
        <div class="chips">
          <Chip
            v-for="c in form.competences"
            :key="c"
            :label="c"
            removable
            @remove="removeCompetence(c)"
          />
        </div>
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

.chip-input {
  display: flex;
  gap: 0.5rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
}
</style>
