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

export interface UE {
  id: string
  name: string
  description: string
  level: number
  details: object[]
  levels: object[]
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

export async function listUEs(): Promise<UE[]> {
  return readJSON<UE[]>(uesFile())
}

export async function updateUELevel(id: string, level: number) {
  const ues = await listUEs()
  const idx = ues.findIndex(u => u.id === id)
  if (idx === -1) throw new Error('UE not found')
  ues[idx].level = level
  await writeJSON(uesFile(), ues)
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