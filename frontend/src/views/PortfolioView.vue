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
import UETable from '@/components/portfolio/UETable.vue'
import ProjectForm from '@/components/portfolio/ProjectForm.vue'

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

export interface UE {
  id: string
  name: string
  description: string
  level: number
  details: object[]
  levels: object[]
}

const toast = useToast()
const projects = ref<Project[]>([])
const ues = ref<UE[]>([])
const loadingProjects = ref(false)
const loadingUEs = ref(false)
const showForm = ref(false)
const editingProject = ref<Project | null>(null)

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

async function fetchUEs() {
  loadingUEs.value = true
  try {
    const { data } = await axios.get('/api/portfolio/ues', { withCredentials: true })
    ues.value = data
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de récupérer les UEs',
      life: 3000,
    })
  } finally {
    loadingUEs.value = false
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

async function handleUpdateLevel(id: string, level: number) {
  try {
    await axios.patch(`/api/portfolio/ues/${id}/level`, { level }, { withCredentials: true })
    await fetchUEs()
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de modifier le niveau',
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
  fetchUEs()
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
          <UETable :ues="ues" :loading="loadingUEs" @update-level="handleUpdateLevel" />
        </TabPanel>
      </TabPanels>
    </Tabs>

    <ProjectForm
      v-if="showForm || editingProject"
      :project="editingProject"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
      @cancel="handleCancel"
    />
  </div>
</template>
