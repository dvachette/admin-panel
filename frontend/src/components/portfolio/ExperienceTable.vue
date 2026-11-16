<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import { EXPERIENCE_TYPES, type Experience } from '@/types/portfolioTypes'

defineProps<{
  experiences: Experience[]
  loading: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [experience: Experience]
  delete: [id: string]
}>()

const confirm = useConfirm()

const typeLabel = (type: Experience['type']) => EXPERIENCE_TYPES.find((t) => t.value === type)?.label ?? type
const typeSeverity = (type: Experience['type']) =>
  type === 'job' ? 'info' : type === 'internship' ? 'success' : 'secondary'

function formatDate(date: string | null) {
  if (!date) return 'En cours'
  const [y, m] = date.split('-')
  return `${m}/${y}`
}

function confirmDelete(id: string) {
  confirm.require({
    group: 'experiences',
    message: 'Supprimer cette expérience ?',
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('delete', id),
  })
}
</script>

<template>
  <ConfirmDialog group="experiences" />
  <div class="table-header">
    <Button label="Nouvelle expérience" icon="pi pi-plus" size="small" @click="emit('create')" />
  </div>
  <DataTable :value="experiences" :loading="loading" stripedRows sortField="startDate" :sortOrder="-1">
    <Column field="title" header="Intitulé" />
    <Column header="Organisation">
      <template #body="{ data }">
        <div>{{ data.organization.name }}</div>
        <small class="muted">{{ data.organization.location }}</small>
      </template>
    </Column>
    <Column field="type" header="Type">
      <template #body="{ data }">
        <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
      </template>
    </Column>
    <Column field="startDate" header="Période" sortable>
      <template #body="{ data }">
        {{ formatDate(data.startDate) }} → {{ formatDate(data.endDate) }}
      </template>
    </Column>
    <Column header="Tags">
      <template #body="{ data }">
        <div class="tags">
          <Tag v-for="tag in data.tags" :key="tag" :value="tag" severity="contrast" />
        </div>
      </template>
    </Column>
    <Column header="Actions">
      <template #body="{ data }">
        <div class="actions">
          <Button icon="pi pi-pencil" size="small" text @click="emit('edit', data)" />
          <Button
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            @click="confirmDelete(data.id)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.table-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.muted {
  color: var(--p-surface-400);
}
</style>
