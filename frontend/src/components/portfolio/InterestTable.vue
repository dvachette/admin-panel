<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import type { Interest } from '@/types/portfolioTypes'

defineProps<{
  interests: Interest[]
  loading: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [interest: Interest]
  delete: [id: string]
}>()

const confirm = useConfirm()

function confirmDelete(id: string) {
  confirm.require({
    group: 'interests',
    message: 'Supprimer ce centre d’intérêt ?',
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
  <ConfirmDialog group="interests" />
  <div class="table-header">
    <Button label="Nouveau centre d’intérêt" icon="pi pi-plus" size="small" @click="emit('create')" />
  </div>
  <DataTable :value="interests" :loading="loading" stripedRows>
    <Column header="Icône" style="width: 4rem">
      <template #body="{ data }">
        <img :src="data.icon" alt="" class="icon" />
      </template>
    </Column>
    <Column field="title" header="Titre" />
    <Column field="description" header="Description">
      <template #body="{ data }">
        <span class="description">{{ data.description }}</span>
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

.icon {
  width: 24px;
  height: 24px;
  /* lucide icons are black strokes: make them visible on the dark theme */
  filter: invert(1);
}

.description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
</style>
