<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import type { Skill, SkillDetail, SkillLevel } from '@/views/PortfolioView.vue'

const props = defineProps<{
  skill: Skill | null
}>()

const emit = defineEmits<{
  submit: [skill: Skill]
  cancel: []
}>()

const isEdit = computed(() => props.skill !== null)

const empty = (): Skill => ({
  id: '',
  name: '',
  image: '',
  description: '',
  level: 1,
  details: [],
  levels: [],
})

const form = ref<Skill>(props.skill ? { ...props.skill } : empty())

watch(() => props.skill, (val) => {
  form.value = val ? { ...val } : empty()
})

const newDetail = ref<SkillDetail>({ id: '', name: '' })
const newLevel = ref<SkillLevel>({ level: 1, levelName: '', description: '', details: [] })
const newLevelDetail = ref<SkillDetail>({ id: '', name: '' })
const editingLevelIndex = ref<number | null>(null)

function addDetail() {
  if (!newDetail.value.id.trim() || !newDetail.value.name.trim()) return
  form.value.details.push({ ...newDetail.value })
  newDetail.value = { id: '', name: '' }
}

function removeDetail(id: string) {
  form.value.details = form.value.details.filter(d => d.id !== id)
}

function addLevelDetail() {
  if (!newLevelDetail.value.id.trim() || !newLevelDetail.value.name.trim()) return
  newLevel.value.details.push({ ...newLevelDetail.value })
  newLevelDetail.value = { id: '', name: '' }
}

function removeLevelDetail(id: string) {
  newLevel.value.details = newLevel.value.details.filter(d => d.id !== id)
}

function addLevel() {
  if (!newLevel.value.levelName.trim() || !newLevel.value.description.trim()) return
  form.value.levels.push({ ...newLevel.value, details: [...newLevel.value.details] })
  newLevel.value = { level: form.value.levels.length + 1, levelName: '', description: '', details: [] }
}

function removeLevel(level: number) {
  form.value.levels = form.value.levels.filter(l => l.level !== level)
}

const valid = computed(() =>
  form.value.id.trim() !== '' &&
  form.value.name.trim() !== '' &&
  form.value.description.trim() !== ''
)

function handleSubmit() {
  if (!valid.value) return
  emit('submit', { ...form.value })
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="isEdit ? 'Modifier la compétence' : 'Nouvelle compétence'"
    :style="{ width: '640px', maxHeight: '90vh' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>ID</label>
        <InputText v-model="form.id" :disabled="isEdit" placeholder="realiser" fluid />
      </div>

      <div class="field">
        <label>Nom</label>
        <InputText v-model="form.name" placeholder="Réaliser" fluid />
      </div>

      <div class="field">
        <label>Image (nom du fichier)</label>
        <InputText v-model="form.image" placeholder="programming.png" fluid />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" rows="3" fluid />
      </div>

      <div class="field">
        <label>Niveau actuel</label>
        <Select
          v-model="form.level"
          :options="form.levels.map(l => ({ label: `${l.levelName} — ${l.description}`, value: l.level }))"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner un niveau"
          fluid
        />
      </div>

      <div class="field">
        <label>Critères d'évaluation</label>
        <div class="inline-form">
          <InputText v-model="newDetail.id" placeholder="CE1.01" style="width: 100px" />
          <InputText v-model="newDetail.name" placeholder="Description" fluid />
          <Button icon="pi pi-plus" size="small" @click="addDetail" />
        </div>
        <DataTable :value="form.details" size="small" class="mt-2">
          <Column field="id" header="ID" style="width: 100px" />
          <Column field="name" header="Description" />
          <Column header="" style="width: 48px">
            <template #body="{ data }">
              <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeDetail(data.id)" />
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="field">
        <label>Niveaux</label>
        <div class="level-form">
          <div class="inline-form">
            <InputNumber v-model="newLevel.level" :min="1" style="width: 80px" />
            <InputText v-model="newLevel.levelName" placeholder="Niveau 1" style="width: 120px" />
            <InputText v-model="newLevel.description" placeholder="Description" fluid />
          </div>
          <div class="inline-form mt-1">
            <InputText v-model="newLevelDetail.id" placeholder="AC11.01" style="width: 100px" />
            <InputText v-model="newLevelDetail.name" placeholder="Apprentissage critique" fluid />
            <Button icon="pi pi-plus" size="small" @click="addLevelDetail" />
          </div>
          <DataTable v-if="newLevel.details.length" :value="newLevel.details" size="small" class="mt-1">
            <Column field="id" header="ID" style="width: 100px" />
            <Column field="name" header="Description" />
            <Column header="" style="width: 48px">
              <template #body="{ data }">
                <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeLevelDetail(data.id)" />
              </template>
            </Column>
          </DataTable>
          <Button label="Ajouter ce niveau" icon="pi pi-plus" size="small" class="mt-1" @click="addLevel" />
        </div>

        <DataTable :value="form.levels" size="small" class="mt-2">
          <Column field="level" header="N°" style="width: 48px" />
          <Column field="levelName" header="Nom" />
          <Column field="description" header="Description" />
          <Column header="" style="width: 48px">
            <template #body="{ data }">
              <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeLevel(data.level)" />
            </template>
          </Column>
        </DataTable>
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
  overflow-y: auto;
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

.inline-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.level-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-800);
  border-radius: 8px;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}
</style>