import fs from 'fs/promises'
import path from 'path'
import multer from 'multer'


const DATA_PATH = process.env.PORTFOLIO_DATA_PATH!

function projectsFile() {
  return path.join(DATA_PATH, 'projects.json')
}

function uesFile() {
  return path.join(DATA_PATH, 'UEs.json')
}

async function readJSON<T>(file: string): Promise<T> {
  const content = await fs.readFile(file, 'utf-8')
  return JSON.parse(content) as T
}

async function writeJSON(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 4), 'utf-8')
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

export async function listProjects(): Promise<Project[]> {
  return readJSON<Project[]>(projectsFile())
}

export async function createProject(project: Project) {
  const projects = await listProjects()
  if (projects.find(p => p.id === project.id)) {
    throw new Error('Project with this id already exists')
  }
  projects.push(project)
  await writeJSON(projectsFile(), projects)
}

export async function updateProject(id: string, data: Partial<Project>) {
  const projects = await listProjects()
  const idx = projects.findIndex(p => p.id === id)
  if (idx === -1) throw new Error('Project not found')
  projects[idx] = { ...projects[idx], ...data, id }
  await writeJSON(projectsFile(), projects)
}

export async function deleteProject(id: string) {
  const projects = await listProjects()
  const filtered = projects.filter(p => p.id !== id)
  if (filtered.length === projects.length) throw new Error('Project not found')
  await writeJSON(projectsFile(), filtered)
}
function skillsFile() {
  return path.join(DATA_PATH, 'skills.json')
}

export async function listSections(): Promise<Section[]> {
  return readJSON<Section[]>(skillsFile())
}

export async function createSection(section: Section) {
  const sections = await listSections()
  sections.push(section)
  await writeJSON(skillsFile(), sections)
}

export async function updateSection(index: number, data: Partial<Section>) {
  const sections = await listSections()
  if (!sections[index]) throw new Error('Section not found')
  sections[index] = { ...sections[index], ...data }
  await writeJSON(skillsFile(), sections)
}

export async function deleteSection(index: number) {
  const sections = await listSections()
  if (!sections[index]) throw new Error('Section not found')
  sections.splice(index, 1)
  await writeJSON(skillsFile(), sections)
}

export async function createSkill(sectionIndex: number, skill: Skill) {
  const sections = await listSections()
  if (!sections[sectionIndex]) throw new Error('Section not found')
  sections[sectionIndex].skills.push(skill)
  await writeJSON(skillsFile(), sections)
}

export async function updateSkill(sectionIndex: number, skillId: string, data: Partial<Skill>) {
  const sections = await listSections()
  if (!sections[sectionIndex]) throw new Error('Section not found')
  const idx = sections[sectionIndex].skills.findIndex(s => s.id === skillId)
  if (idx === -1) throw new Error('Skill not found')
  sections[sectionIndex].skills[idx] = { ...sections[sectionIndex].skills[idx], ...data, id: skillId }
  await writeJSON(skillsFile(), sections)
}

export async function deleteSkill(sectionIndex: number, skillId: string) {
  const sections = await listSections()
  if (!sections[sectionIndex]) throw new Error('Section not found')
  const filtered = sections[sectionIndex].skills.filter(s => s.id !== skillId)
  if (filtered.length === sections[sectionIndex].skills.length) throw new Error('Skill not found')
  sections[sectionIndex].skills = filtered
  await writeJSON(skillsFile(), sections)
}

export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, process.env.PORTFOLIO_IMAGES_PATH!)
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname)
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Invalid file type'))
  },
})

export async function listImages(): Promise<string[]> {
  const files = await fs.readdir(process.env.PORTFOLIO_IMAGES_PATH!)
  return files.filter(f => ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(f).toLowerCase()))
}