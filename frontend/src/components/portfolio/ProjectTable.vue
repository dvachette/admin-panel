<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import type { Project } from '@/views/PortfolioView.vue'

defineProps<{
  projects: Project[]
  loading: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [project: Project]
  delete: [id: string]
}>()

const confirm = useConfirm()

function confirmDelete(id: string) {
  confirm.require({
    message: 'Supprimer ce projet ?',
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
  <ConfirmDialog />
  <div class="table-header">
    <Button label="Nouveau projet" icon="pi pi-plus" size="small" @click="emit('create')" />
  </div>
  <DataTable :value="projects" :loading="loading" stripedRows>
    <Column field="id" header="ID" />
    <Column field="title" header="Titre" />
    <Column field="projectType" header="Type">
      <template #body="{ data }">
        <Tag
          :value="data.projectType"
          :severity="data.projectType === 'Personal' ? 'info' : 'secondary'"
        />
      </template>
    </Column>
    <Column header="Langages">
      <template #body="{ data }">
        <div class="tags">
          <Tag
            v-for="lang in data.programmingLanguages"
            :key="lang"
            :value="lang"
            severity="contrast"
          />
        </div>
      </template>
    </Column>
    <Column header="Liens">
      <template #body="{ data }">
        <div class="actions">
          <a v-if="data.liveDemoLink" :href="data.liveDemoLink" target="_blank">
            <Button icon="pi pi-external-link" size="small" text />
          </a>
          <a v-if="data.sourceCodeLink" :href="data.sourceCodeLink" target="_blank">
            <Button icon="pi pi-github" size="small" text />
          </a>
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
</style>
