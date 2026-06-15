<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'
import Tabs from 'primevue/tabs'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProjectTable from '@/components/portfolio/ProjectTable.vue'
import ProjectForm from '@/components/portfolio/ProjectForm.vue'
import SkillsManager from '@/components/portfolio/SkillsManager.vue'

export interface SkillDetail {
  id: string
  name: string
}

export interface SkillLevel {
  level: number
  levelName: string
  description: string
  details: SkillDetail[]
}

export interface Skill {
  id: string
  name: string
  image: string
  description: string
  level: number
  details: SkillDetail[]
  levels: SkillLevel[]
}

export interface Section {
  section: string
  icon: string
  skills: Skill[]
}
export interface Project {
  id: string
  projectType: string
  title: string
  description: string
  image: string
  liveDemoLink?: string
  sourceCodeLink?: string
  competences: string[]
  programmingLanguages: string[]
}



const toast = useToast()
const projects = ref<Project[]>([])
const sections = ref<Section[]>([])
const loadingSections = ref(false)
const loadingProjects = ref(false)
const showForm = ref(false)
const editingProject = ref<Project | null>(null)

const images = ref<string[]>([])

async function fetchImages() {
  try {
    const { data } = await axios.get('/api/portfolio/images', { withCredentials: true })
    images.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de récupérer les images',
      life: 3000,
    })
  }
}

async function fetchProjects() {
  loadingProjects.value = true
  try {
    const { data } = await axios.get('/api/portfolio/projects', { withCredentials: true })
    projects.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de récupérer les projets',
      life: 3000,
    })
  } finally {
    loadingProjects.value = false
  }
}

async function fetchSections() {
  loadingSections.value = true
  try {
    const { data } = await axios.get('/api/portfolio/sections', { withCredentials: true })
    sections.value = data
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de récupérer les compétences', life: 3000 })
  } finally {
    loadingSections.value = false
  }
}

async function handleCreateSection(section: Section) {
  try {
    await axios.post('/api/portfolio/sections', section, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Créé', detail: 'Section créée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de créer la section', life: 3000 })
  }
}

async function handleUpdateSection(index: number, section: Section) {
  try {
    await axios.put(`/api/portfolio/sections/${index}`, section, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Modifié', detail: 'Section modifiée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de modifier la section', life: 3000 })
  }
}

async function handleDeleteSection(index: number) {
  try {
    await axios.delete(`/api/portfolio/sections/${index}`, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Supprimé', detail: 'Section supprimée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer la section', life: 3000 })
  }
}

async function handleCreateSkill(sectionIndex: number, skill: Skill) {
  try {
    await axios.post(`/api/portfolio/sections/${sectionIndex}/skills`, skill, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Créé', detail: 'Compétence créée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de créer la compétence', life: 3000 })
  }
}

async function handleUpdateSkill(sectionIndex: number, skillId: string, skill: Skill) {
  try {
    await axios.put(`/api/portfolio/sections/${sectionIndex}/skills/${skillId}`, skill, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Modifié', detail: 'Compétence modifiée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de modifier la compétence', life: 3000 })
  }
}

async function handleDeleteSkill(sectionIndex: number, skillId: string) {
  try {
    await axios.delete(`/api/portfolio/sections/${sectionIndex}/skills/${skillId}`, { withCredentials: true })
    await fetchSections()
    toast.add({ severity: 'success', summary: 'Supprimé', detail: 'Compétence supprimée', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer la compétence', life: 3000 })
  }
}

async function handleCreate(project: Project) {
  try {
    await axios.post('/api/portfolio/projects', project, { withCredentials: true })
    showForm.value = false
    await fetchProjects()
    toast.add({ severity: 'success', summary: 'Créé', detail: 'Projet créé', life: 2000 })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de créer le projet',
      life: 3000,
    })
  }
}

async function handleUpdate(project: Project) {
  try {
    await axios.put(`/api/portfolio/projects/${project.id}`, project, { withCredentials: true })
    editingProject.value = null
    await fetchProjects()
    toast.add({ severity: 'success', summary: 'Modifié', detail: 'Projet modifié', life: 2000 })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de modifier le projet',
      life: 3000,
    })
  }
}

async function handleDelete(id: string) {
  try {
    await axios.delete(`/api/portfolio/projects/${id}`, { withCredentials: true })
    await fetchProjects()
    toast.add({ severity: 'success', summary: 'Supprimé', detail: 'Projet supprimé', life: 2000 })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de supprimer le projet',
      life: 3000,
    })
  }
}



function handleEdit(project: Project) {
  editingProject.value = { ...project }
}

function handleCancel() {
  showForm.value = false
  editingProject.value = null
}

onMounted(() => {
  fetchProjects()
  fetchSections()
  fetchImages()
})
</script>

<template>
  <div>
    <h2>Portfolio</h2>
    <Tabs value="projects">
      <TabList>
        <Tab value="projects">Projets</Tab>
        <Tab value="ues">Compétences</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="projects">
          <ProjectTable
            :projects="projects"
            :loading="loadingProjects"
            @create="showForm = true"
            @edit="handleEdit"
            @delete="handleDelete"
          />
        </TabPanel>
        <TabPanel value="ues">
          <SkillsManager
            :sections="sections"
            :loading="loadingSections"
            @create-section="handleCreateSection"
            @update-section="handleUpdateSection"
            @delete-section="handleDeleteSection"
            @create-skill="handleCreateSkill"
            @update-skill="handleUpdateSkill"
            @delete-skill="handleDeleteSkill"
          />
</TabPanel>
      </TabPanels>
    </Tabs>

    <ProjectForm
      v-if="showForm || editingProject"
      :project="editingProject"
      :sections="sections"
      :projects="projects"
      :images="images"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
      @cancel="handleCancel"
    />
  </div>
</template>
