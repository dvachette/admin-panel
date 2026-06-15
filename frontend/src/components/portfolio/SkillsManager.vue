<script setup lang="ts">
import { ref } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import SectionForm from './SectionForm.vue'
import SkillForm from './SkillForm.vue'
import type { Section, Skill } from '@/views/PortfolioView.vue'

defineProps<{
  sections: Section[]
  loading: boolean
}>()

const emit = defineEmits<{
  createSection: [section: Section]
  updateSection: [index: number, section: Section]
  deleteSection: [index: number]
  createSkill: [sectionIndex: number, skill: Skill]
  updateSkill: [sectionIndex: number, skillId: string, skill: Skill]
  deleteSkill: [sectionIndex: number, skillId: string]
}>()

const confirm = useConfirm()
const showSectionForm = ref(false)
const editingSection = ref<{ index: number; section: Section } | null>(null)
const showSkillForm = ref<number | null>(null)
const editingSkill = ref<{ sectionIndex: number; skill: Skill } | null>(null)

function confirmDeleteSection(index: number) {
  confirm.require({
    message: 'Supprimer cette section et toutes ses compétences ?',
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('deleteSection', index),
  })
}

function confirmDeleteSkill(sectionIndex: number, skillId: string) {
  confirm.require({
    message: 'Supprimer cette compétence ?',
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('deleteSkill', sectionIndex, skillId),
  })
}

function handleSectionSubmit(section: Section) {
  if (editingSection.value !== null) {
    emit('updateSection', editingSection.value.index, section)
    editingSection.value = null
  } else {
    emit('createSection', section)
    showSectionForm.value = false
  }
}

function handleSkillSubmit(skill: Skill) {
  if (editingSkill.value !== null) {
    emit('updateSkill', editingSkill.value.sectionIndex, editingSkill.value.skill.id, skill)
    editingSkill.value = null
  } else if (showSkillForm.value !== null) {
    emit('createSkill', showSkillForm.value, skill)
    showSkillForm.value = null
  }
}
</script>

<template>
  <ConfirmDialog />

  <div class="header">
    <Button label="Nouvelle section" icon="pi pi-plus" size="small" @click="showSectionForm = true" />
  </div>

  <Accordion>
    <AccordionPanel v-for="(section, sIndex) in sections" :key="sIndex" :value="String(sIndex)">
      <AccordionHeader>
        <div class="section-header">
          <img v-if="section.icon" :src="section.icon" class="section-icon" />
          <span>{{ section.section }}</span>
          <div class="section-actions" @click.stop>
            <Button
              icon="pi pi-pencil"
              size="small"
              text
              @click="editingSection = { index: sIndex, section: { ...section } }"
            />
            <Button
              icon="pi pi-trash"
              size="small"
              severity="danger"
              text
              @click="confirmDeleteSection(sIndex)"
            />
          </div>
        </div>
      </AccordionHeader>
      <AccordionContent>
        <div class="skill-table-header">
          <Button
            label="Nouvelle compétence"
            icon="pi pi-plus"
            size="small"
            @click="showSkillForm = sIndex"
          />
        </div>
        <DataTable :value="section.skills" stripedRows size="small">
          <Column field="name" header="Nom" />
          <Column field="description" header="Description" />
          <Column field="level" header="Niveau" />
          <Column header="Actions">
            <template #body="{ data }">
              <div class="actions">
                <Button
                  icon="pi pi-pencil"
                  size="small"
                  text
                  @click="editingSkill = { sectionIndex: sIndex, skill: { ...data } }"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  @click="confirmDeleteSkill(sIndex, data.id)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>

  <SectionForm
    v-if="showSectionForm || editingSection"
    :section="editingSection?.section ?? null"
    @submit="handleSectionSubmit"
    @cancel="showSectionForm = false; editingSection = null"
  />

  <SkillForm
    v-if="showSkillForm !== null || editingSkill"
    :skill="editingSkill?.skill ?? null"
    @submit="handleSkillSubmit"
    @cancel="showSkillForm = null; editingSkill = null"
  />
</template>

<style scoped>
.header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.section-icon {
  width: 20px;
  height: 20px;
}

.section-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.skill-table-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.25rem;
}
</style>