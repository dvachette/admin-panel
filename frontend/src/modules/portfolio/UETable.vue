<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import type { UE } from '@/views/PortfolioView.vue'

defineProps<{
  ues: UE[]
  loading: boolean
}>()

const emit = defineEmits<{
  updateLevel: [id: string, level: number]
}>()

function levelOptions(ue: UE) {
  return (ue.levels as { level: number; description: string }[]).map((l) => ({
    label: `Niveau ${l.level} — ${l.description}`,
    value: l.level,
  }))
}
</script>

<template>
  <DataTable :value="ues" :loading="loading" stripedRows>
    <Column field="name" header="Compétence" />
    <Column field="description" header="Description" />
    <Column header="Niveau">
      <template #body="{ data }">
        <Select
          :model-value="data.level"
          :options="levelOptions(data)"
          option-label="label"
          option-value="value"
          @update:model-value="(val) => emit('updateLevel', data.id, val)"
        />
      </template>
    </Column>
  </DataTable>
</template>
