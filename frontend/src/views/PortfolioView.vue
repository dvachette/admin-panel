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
import ExperienceTable from '@/components/portfolio/ExperienceTable.vue'
import ExperienceForm from '@/components/portfolio/ExperienceForm.vue'
import InterestTable from '@/components/portfolio/InterestTable.vue'
import InterestForm from '@/components/portfolio/InterestForm.vue'
import type { Experience, Interest } from '@/types/portfolioTypes'

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

const experiences = ref<Experience[]>([])
const loadingExperiences = ref(false)
const showExperienceForm = ref(false)
const editingExperience = ref<Experience | null>(null)

const interests = ref<Interest[]>([])
const loadingInterests = ref(false)
const showInterestForm = ref(false)
const editingInterest = ref<Interest | null>(null)

/** Error message returned by the backend (forwarded from the portfolio API), if any */
function apiError(err: unknown, fallback: string): string {
  return (axios.isAxiosError(err) && err.response?.data?.error) || fallback
}

async function fetchExperiences() {
  loadingExperiences.value = true
  try {
    const { data } = await axios.get('/api/portfolio/experiences', { withCredentials: true })
    experiences.value = data
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible de récupérer les expériences'), life: 3000 })
  } finally {
    loadingExperiences.value = false
  }
}

async function saveExperience(experience: Experience, isEdit: boolean) {
  try {
    if (isEdit) {
      await axios.put(`/api/portfolio/experiences/${encodeURIComponent(experience.id)}`, experience, { withCredentials: true })
    } else {
      await axios.post('/api/portfolio/experiences', experience, { withCredentials: true })
    }
    showExperienceForm.value = false
    editingExperience.value = null
    await fetchExperiences()
    toast.add({ severity: 'success', summary: isEdit ? 'Modifié' : 'Créé', detail: isEdit ? 'Expérience modifiée' : 'Expérience créée', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible d’enregistrer l’expérience'), life: 4000 })
  }
}

async function deleteExperience(id: string) {
  try {
    await axios.delete(`/api/portfolio/experiences/${encodeURIComponent(id)}`, { withCredentials: true })
    await fetchExperiences()
    toast.add({ severity: 'success', summary: 'Supprimé', detail: 'Expérience supprimée', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible de supprimer l’expérience'), life: 4000 })
  }
}

function cancelExperience() {
  showExperienceForm.value = false
  editingExperience.value = null
}

async function fetchInterests() {
  loadingInterests.value = true
  try {
    const { data } = await axios.get('/api/portfolio/interests', { withCredentials: true })
    interests.value = data
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible de récupérer les centres d’intérêt'), life: 3000 })
  } finally {
    loadingInterests.value = false
  }
}

async function saveInterest(interest: Interest, isEdit: boolean) {
  try {
    if (isEdit) {
      await axios.put(`/api/portfolio/interests/${encodeURIComponent(interest.id)}`, interest, { withCredentials: true })
    } else {
      await axios.post('/api/portfolio/interests', interest, { withCredentials: true })
    }
    showInterestForm.value = false
    editingInterest.value = null
    await fetchInterests()
    toast.add({ severity: 'success', summary: isEdit ? 'Modifié' : 'Créé', detail: isEdit ? 'Centre d’intérêt modifié' : 'Centre d’intérêt créé', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible d’enregistrer le centre d’intérêt'), life: 4000 })
  }
}

async function deleteInterest(id: string) {
  try {
    await axios.delete(`/api/portfolio/interests/${encodeURIComponent(id)}`, { withCredentials: true })
    await fetchInterests()
    toast.add({ severity: 'success', summary: 'Supprimé', detail: 'Centre d’intérêt supprimé', life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: apiError(err, 'Impossible de supprimer le centre d’intérêt'), life: 4000 })
  }
}

function cancelInterest() {
  showInterestForm.value = false
  editingInterest.value = null
}

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
  fetchExperiences()
  fetchInterests()
})
</script>

<template>
  <div>
    <h2>Portfolio</h2>
    <Tabs value="projects">
      <TabList>
        <Tab value="projects">Projets</Tab>
        <Tab value="ues">Compétences</Tab>
        <Tab value="experiences">Expériences</Tab>
        <Tab value="interests">Centres d’intérêt</Tab>
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
        <TabPanel value="experiences">
          <ExperienceTable
            :experiences="experiences"
            :loading="loadingExperiences"
            @create="showExperienceForm = true"
            @edit="(e) => (editingExperience = e)"
            @delete="deleteExperience"
          />
        </TabPanel>
        <TabPanel value="interests">
          <InterestTable
            :interests="interests"
            :loading="loadingInterests"
            @create="showInterestForm = true"
            @edit="(i) => (editingInterest = i)"
            @delete="deleteInterest"
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

    <ExperienceForm
      v-if="showExperienceForm || editingExperience"
      :experience="editingExperience"
      :experiences="experiences"
      @submit-create="(e) => saveExperience(e, false)"
      @submit-update="(e) => saveExperience(e, true)"
      @cancel="cancelExperience"
    />

    <InterestForm
      v-if="showInterestForm || editingInterest"
      :interest="editingInterest"
      :interests="interests"
      @submit-create="(i) => saveInterest(i, false)"
      @submit-update="(i) => saveInterest(i, true)"
      @cancel="cancelInterest"
    />
  </div>
</template>
