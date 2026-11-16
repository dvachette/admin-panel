<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Message from 'primevue/message'
import {
  EXPERIENCE_TYPES,
  WORKLOADS,
  slugify,
  type Experience,
} from '@/types/portfolioTypes'

const props = defineProps<{
  experience: Experience | null
  experiences: Experience[]
}>()

const emit = defineEmits<{
  submitCreate: [experience: Experience]
  submitUpdate: [experience: Experience]
  cancel: []
}>()

const isEdit = computed(() => props.experience !== null)

// Dates are stored as YYYY-MM-DD; build local dates to avoid timezone shifts
function toDate(value: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface FormState {
  id: string
  type: Experience['type']
  title: string
  orgName: string
  orgWebsite: string
  orgLocation: string
  startDate: Date | null
  endDate: Date | null
  ongoing: boolean
  workload: Experience['workload']
  highlights: string
  tags: string[]
}

function toForm(exp: Experience | null): FormState {
  return {
    id: exp?.id ?? '',
    type: exp?.type ?? 'job',
    title: exp?.title ?? '',
    orgName: exp?.organization.name ?? '',
    orgWebsite: exp?.organization.website ?? '',
    orgLocation: exp?.organization.location ?? '',
    startDate: toDate(exp?.startDate ?? null),
    endDate: toDate(exp?.endDate ?? null),
    ongoing: exp ? exp.endDate === null : false,
    workload: exp?.workload ?? 'full-time',
    highlights: exp?.highlights.join('\n') ?? '',
    tags: [...(exp?.tags ?? [])],
  }
}

const form = ref<FormState>(toForm(props.experience))

watch(
  () => props.experience,
  (val) => {
    form.value = toForm(val)
  },
)

// Suggest an id like "onyx-2026" from the organization and start year
watch(
  () => [form.value.orgName, form.value.startDate] as const,
  ([name, start]) => {
    if (isEdit.value) return
    form.value.id = slugify([name, start?.getFullYear()].filter(Boolean).join(' '))
  },
)

const idCollision = computed(
  () => !isEdit.value && props.experiences.some((e) => e.id === form.value.id),
)

const datesInvalid = computed(
  () =>
    !form.value.ongoing &&
    form.value.startDate !== null &&
    form.value.endDate !== null &&
    form.value.endDate < form.value.startDate,
)

const valid = computed(() => {
  const f = form.value
  return (
    f.id.trim() !== '' &&
    f.title.trim() !== '' &&
    f.orgName.trim() !== '' &&
    f.orgLocation.trim() !== '' &&
    f.startDate !== null &&
    (f.ongoing || f.endDate !== null) &&
    !datesInvalid.value &&
    !idCollision.value
  )
})

function toExperience(f: FormState): Experience {
  const website = f.orgWebsite.trim()
  return {
    id: f.id.trim(),
    type: f.type,
    title: f.title.trim(),
    organization: {
      name: f.orgName.trim(),
      ...(website && { website }),
      location: f.orgLocation.trim(),
    },
    startDate: toIso(f.startDate!),
    endDate: f.ongoing || !f.endDate ? null : toIso(f.endDate),
    workload: f.workload,
    highlights: f.highlights
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean),
    tags: f.tags.map((t) => t.trim()).filter(Boolean),
  }
}

function handleSubmit() {
  if (!valid.value) return
  const experience = toExperience(form.value)
  if (isEdit.value) emit('submitUpdate', experience)
  else emit('submitCreate', experience)
}
</script>

<template>
  <Dialog
    visible
    modal
    :header="isEdit ? 'Modifier l’expérience' : 'Nouvelle expérience'"
    :style="{ width: '620px' }"
    @update:visible="emit('cancel')"
  >
    <div class="form">
      <div class="field">
        <label>Intitulé du poste</label>
        <InputText v-model="form.title" placeholder="Développeur web" fluid />
      </div>

      <div class="row">
        <div class="field">
          <label>Type</label>
          <Select
            v-model="form.type"
            :options="EXPERIENCE_TYPES"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>
        <div class="field">
          <label>Temps de travail</label>
          <Select
            v-model="form.workload"
            :options="WORKLOADS"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>
      </div>

      <fieldset class="group">
        <legend>Organisation</legend>
        <div class="field">
          <label>Nom</label>
          <InputText v-model="form.orgName" fluid />
        </div>
        <div class="row">
          <div class="field">
            <label>Lieu</label>
            <InputText v-model="form.orgLocation" placeholder="Lyon, France" fluid />
          </div>
          <div class="field">
            <label>Site web (optionnel)</label>
            <InputText v-model="form.orgWebsite" placeholder="https://..." fluid />
          </div>
        </div>
      </fieldset>

      <div class="field">
        <label>ID</label>
        <InputText v-model="form.id" :disabled="isEdit" fluid />
        <Message v-if="idCollision" severity="error" size="small"> Cet ID existe déjà </Message>
      </div>

      <div class="row">
        <div class="field">
          <label>Début</label>
          <DatePicker v-model="form.startDate" date-format="dd/mm/yy" show-icon fluid />
        </div>
        <div class="field">
          <label>Fin</label>
          <DatePicker
            v-model="form.endDate"
            date-format="dd/mm/yy"
            show-icon
            fluid
            :disabled="form.ongoing"
          />
        </div>
      </div>
      <div class="inline">
        <ToggleSwitch v-model="form.ongoing" input-id="ongoing" />
        <label for="ongoing">En cours</label>
      </div>
      <Message v-if="datesInvalid" severity="error" size="small">
        La date de fin est antérieure à la date de début
      </Message>

      <div class="field">
        <label>Missions (une par ligne)</label>
        <Textarea v-model="form.highlights" rows="5" fluid />
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
  flex: 1;
}

.row {
  display: flex;
  gap: 1rem;
}

.inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: -0.5rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--p-surface-700);
  border-radius: 8px;
  padding: 0.75rem 1rem 1rem;
  margin: 0;
}

legend {
  padding: 0 0.25rem;
  font-size: 0.875rem;
  color: var(--p-surface-300);
}

label {
  font-size: 0.875rem;
  color: var(--p-surface-300);
}
</style>
