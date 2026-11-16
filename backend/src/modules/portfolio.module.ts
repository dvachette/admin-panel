import fs from 'fs/promises'
import path from 'path'
import multer from 'multer'

const API_URL = (process.env.PORTFOLIO_API_URL || 'http://127.0.0.1:3003').replace(/\/+$/, '')
const API_TOKEN = process.env.PORTFOLIO_API_TOKEN

/** Error returned by the portfolio API, carrying its HTTP status. */
export class PortfolioApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(method: string, route: string, body?: unknown): Promise<T> {
  if (!API_TOKEN) throw new PortfolioApiError(503, 'PORTFOLIO_API_TOKEN is not configured')

  let res: Response
  try {
    res = await fetch(`${API_URL}/admin${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new PortfolioApiError(502, 'Portfolio API is unreachable')
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new PortfolioApiError(res.status, data?.error ?? `Portfolio API responded ${res.status}`)
  }
  return data as T
}

/** The portfolio API rejects empty strings: drop them (also in nested objects) so optional fields are simply omitted. */
function withoutEmptyStrings<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? withoutEmptyStrings(v) : v]),
  ) as T
}

const enc = encodeURIComponent

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
  return request('GET', '/projects')
}

export async function createProject(project: Project) {
  await request('POST', '/projects', withoutEmptyStrings(project))
}

export async function updateProject(id: string, data: Project) {
  await request('PUT', `/projects/${enc(id)}`, withoutEmptyStrings(data))
}

export async function deleteProject(id: string) {
  await request('DELETE', `/projects/${enc(id)}`)
}

export async function listSections(): Promise<Section[]> {
  return request('GET', '/skills')
}

export async function createSection(section: Section) {
  await request('POST', '/skills', section)
}

export async function updateSection(index: number, data: Partial<Section>) {
  // Skills are managed through their own routes; the API refuses them here
  await request('PATCH', `/skills/${index}`, { section: data.section, icon: data.icon })
}

export async function deleteSection(index: number) {
  await request('DELETE', `/skills/${index}`)
}

export async function createSkill(sectionIndex: number, skill: Skill) {
  await request('POST', `/skills/${sectionIndex}/skills`, skill)
}

export async function updateSkill(sectionIndex: number, skillId: string, data: Skill) {
  await request('PUT', `/skills/${sectionIndex}/skills/${enc(skillId)}`, data)
}

export async function deleteSkill(sectionIndex: number, skillId: string) {
  await request('DELETE', `/skills/${sectionIndex}/skills/${enc(skillId)}`)
}

export interface Organization {
  name: string
  website?: string
  location: string
}

export interface Experience {
  id: string
  type: 'job' | 'internship' | 'association'
  title: string
  organization: Organization
  startDate: string
  endDate: string | null
  workload: 'full-time' | 'part-time' | 'volunteer'
  highlights: string[]
  tags: string[]
}

export interface Interest {
  id: string
  title: string
  icon: string
  description: string
  tags: string[]
}

export async function listExperiences(): Promise<Experience[]> {
  return request('GET', '/experiences')
}

export async function createExperience(experience: Experience) {
  await request('POST', '/experiences', withoutEmptyStrings(experience))
}

export async function updateExperience(id: string, data: Experience) {
  await request('PUT', `/experiences/${enc(id)}`, withoutEmptyStrings(data))
}

export async function deleteExperience(id: string) {
  await request('DELETE', `/experiences/${enc(id)}`)
}

export async function listInterests(): Promise<Interest[]> {
  return request('GET', '/interests')
}

export async function createInterest(interest: Interest) {
  await request('POST', '/interests', withoutEmptyStrings(interest))
}

export async function updateInterest(id: string, data: Interest) {
  await request('PUT', `/interests/${enc(id)}`, withoutEmptyStrings(data))
}

export async function deleteInterest(id: string) {
  await request('DELETE', `/interests/${enc(id)}`)
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