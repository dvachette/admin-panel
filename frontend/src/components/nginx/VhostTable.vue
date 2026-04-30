<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import type { Vhost } from '@/types/nginxTypes'

const props = defineProps<{
  vhosts: Vhost[]
  loading: boolean
}>()

const emit = defineEmits<{
  enable: [name: string]
  disable: [name: string]
  delete: [name: string]
}>()

const confirm = useConfirm()

function confirmDelete(name: string) {
  confirm.require({
    message: `Supprimer le vhost "${name}" ?`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('delete', name),
  })
}
</script>

<template>
  <ConfirmDialog />
  <DataTable :value="vhosts" :loading="loading" stripedRows>
    <Column field="name" header="Nom" />
    <Column header="État">
      <template #body="{ data }">
        <Tag
          :value="data.enabled ? 'activé' : 'désactivé'"
          :severity="data.enabled ? 'success' : 'secondary'"
        />
      </template>
    </Column>
    <Column header="Actions">
      <template #body="{ data }">
        <div class="actions">
          <Button
            v-if="!data.enabled"
            icon="pi pi-check"
            size="small"
            severity="success"
            text
            tooltip="Activer"
            @click="emit('enable', data.name)"
          />
          <Button
            v-else
            icon="pi pi-times"
            size="small"
            severity="warning"
            text
            tooltip="Désactiver"
            @click="emit('disable', data.name)"
          />
          <Button
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            @click="confirmDelete(data.name)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.25rem;
}
</style>
