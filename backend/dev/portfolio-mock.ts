/**
 * In-memory mock of the portfolio backend admin API (see portfolio-backend/openapi.yaml),
 * limited to the routes used by the admin panel: /admin/projects, /admin/skills, /admin/experiences
 * and /admin/interests.
 *
 * Usage: npm run mock:portfolio, then npm run dev.
 *   The mock reads the same .env as the admin backend: leave PORTFOLIO_API_URL empty (defaults to
 *   http://127.0.0.1:3003) and PORTFOLIO_API_TOKEN is shared (defaults to "dev-portfolio-token").
 *
 * Data is reset on every restart. Set PORTFOLIO_MOCK_DATA_DIR to a directory containing
 * projects.json, skills.json, experiences.json and interests.json (e.g. ../../portfolio/portfolio-backend/data) to seed from real data.
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Experience, Interest, Project, Section, Skill } from '../src/modules/portfolio.module'

const PORT = Number(process.env.PORTFOLIO_MOCK_PORT || 3003)
const MOCK_TOKEN = process.env.PORTFOLIO_API_TOKEN || 'dev-portfolio-token'
const LATENCY_MS = Number(process.env.PORTFOLIO_MOCK_LATENCY_MS || 0)

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ------------------------------------------------------------------ seed data
const defaultSkill = (id: string, name: string): Skill => ({
  id,
  name,
  image: `${id}.png`,
  description: `Description of ${name}`,
  level: 1,
  details: [{ id: `${id}-d1`, name: `${name} detail` }],
  levels: [
    { level: 1, levelName: 'Beginner', description: `${name} basics`, details: [] },
    { level: 2, levelName: 'Intermediate', description: `${name} in depth`, details: [] },
  ],
})

let sections: Section[] = [
  { section: 'Core skills', icon: 'https://unpkg.com/lucide-static@0.460.0/icons/code.svg', skills: [defaultSkill('realiser', 'Build'), defaultSkill('optimiser', 'Optimize')] },
  { section: 'Web development', icon: 'https://unpkg.com/lucide-static@0.460.0/icons/globe.svg', skills: [defaultSkill('vue', 'Vue')] },
]

let projects: Project[] = [
  {
    id: 'demo-project',
    projectType: 'Personal',
    title: 'Demo project',
    description: 'A project served by the portfolio mock',
    image: 'demo.png',
    sourceCodeLink: 'https://example.com/demo',
    competences: ['realiser', 'vue'],
    programmingLanguages: ['TypeScript', 'Vue'],
  },
]

let experiences: Experience[] = [
  {
    id: 'demo-internship',
    type: 'internship',
    title: 'Web developer intern',
    organization: { name: 'Demo Corp', website: 'https://example.com', location: 'Lyon, France' },
    startDate: '2026-04-07',
    endDate: '2026-06-26',
    workload: 'full-time',
    highlights: ['Built a CRM module', 'Wrote tests'],
    tags: ['CRM', 'Vue'],
  },
  {
    id: 'demo-association',
    type: 'association',
    title: 'Treasurer',
    organization: { name: 'Demo Association', location: 'Toulouse, France' },
    startDate: '2025-09-01',
    endDate: null,
    workload: 'volunteer',
    highlights: ['Managed the budget'],
    tags: [],
  },
]

let interests: Interest[] = [
  {
    id: 'open-source',
    title: 'Open source',
    icon: 'https://unpkg.com/lucide-static@0.460.0/icons/git-fork.svg',
    description: 'Collaboration and knowledge sharing.',
    tags: ['Debian', 'Linux'],
  },
]

const seedDir = process.env.PORTFOLIO_MOCK_DATA_DIR
if (seedDir) {
  const load = (file: string) => JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf-8'))
  projects = load('projects.json')
  sections = load('skills.json')
  experiences = load('experiences.json')
  interests = load('interests.json')
}

// ------------------------------------------------------------------ helpers
/** Mimics the real API: empty strings are rejected. */
function assertNoEmptyStrings(value: unknown, where = 'body') {
  if (typeof value === 'string' && value.trim() === '') throw new HttpError(400, `${where} must not be empty`)
  if (Array.isArray(value)) value.forEach((v, i) => assertNoEmptyStrings(v, `${where}[${i}]`))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertNoEmptyStrings(v, `${where}.${k}`)
  }
}

function assertRequired(body: Record<string, unknown>, fields: string[]) {
  for (const f of fields) if (body[f] === undefined) throw new HttpError(400, `body.${f} is required`)
}

const allSkillIds = () => new Set(sections.flatMap(s => s.skills.map(sk => sk.id)))

function getSection(req: Request): Section {
  const index = Number(req.params.section)
  const section = Number.isInteger(index) ? sections[index] : undefined
  if (!section) throw new HttpError(404, `No section at index ${req.params.section}`)
  return section
}

function assertSkillsUnused(ids: string[]) {
  const users = projects.filter(p => p.competences.some(c => ids.includes(c))).map(p => p.id)
  if (users.length) throw new HttpError(409, `Skill(s) still used by project(s): ${users.join(', ')}`)
}

function assertKnownCompetences(project: Project) {
  const known = allSkillIds()
  const unknown = project.competences.filter(id => !known.has(id))
  if (unknown.length) throw new HttpError(409, `Unknown skill id(s): ${unknown.join(', ')}`)
}

const PROJECT_FIELDS = ['projectType', 'title', 'description', 'image', 'competences', 'programmingLanguages']
const SKILL_FIELDS = ['name', 'image', 'description', 'level', 'details', 'levels']

// ------------------------------------------------------------------ routes
const admin = express.Router()

admin.get('/projects', (_req, res) => {
  res.json(projects)
})

admin.post('/projects', (req, res) => {
  const project = req.body as Project
  assertNoEmptyStrings(project)
  assertRequired(req.body, ['id', ...PROJECT_FIELDS])
  if (projects.some(p => p.id === project.id)) throw new HttpError(409, `An item with id "${project.id}" already exists in projects`)
  assertKnownCompetences(project)
  projects.push(project)
  res.status(201).json(project)
})

function findProjectIndex(id: string) {
  const idx = projects.findIndex(p => p.id === id)
  if (idx === -1) throw new HttpError(404, `No item with id "${id}" in projects`)
  return idx
}

admin.get('/projects/:id', (req, res) => {
  res.json(projects[findProjectIndex(req.params.id as string)])
})

admin.put('/projects/:id', (req, res) => {
  const id = req.params.id as string
  const idx = findProjectIndex(id)
  assertNoEmptyStrings(req.body)
  assertRequired(req.body, PROJECT_FIELDS)
  const project = { ...req.body, id } as Project
  assertKnownCompetences(project)
  projects[idx] = project
  res.json(project)
})

admin.patch('/projects/:id', (req, res) => {
  const id = req.params.id as string
  const idx = findProjectIndex(id)
  assertNoEmptyStrings(req.body)
  const merged: Record<string, unknown> = { ...projects[idx], ...req.body, id }
  // `null` on an optional field removes it
  for (const [k, v] of Object.entries(merged)) if (v === null) delete merged[k]
  const project = merged as unknown as Project
  assertKnownCompetences(project)
  projects[idx] = project
  res.json(project)
})

admin.delete('/projects/:id', (req, res) => {
  projects.splice(findProjectIndex(req.params.id as string), 1)
  res.status(204).end()
})

admin.get('/skills', (_req, res) => {
  res.json(sections)
})

admin.post('/skills', (req, res) => {
  assertNoEmptyStrings(req.body)
  assertRequired(req.body, ['section', 'icon'])
  const section: Section = { section: req.body.section, icon: req.body.icon, skills: req.body.skills ?? [] }
  const known = allSkillIds()
  const dup = section.skills.find(s => known.has(s.id))
  if (dup) throw new HttpError(409, `Skill id "${dup.id}" already exists`)
  sections.push(section)
  res.status(201).json(section)
})

admin.patch('/skills/:section', (req, res) => {
  const section = getSection(req)
  if ('skills' in req.body) throw new HttpError(400, 'body.skills is not allowed here')
  assertNoEmptyStrings(req.body)
  if (req.body.section !== undefined) section.section = req.body.section
  if (req.body.icon !== undefined) section.icon = req.body.icon
  res.json(section)
})

admin.delete('/skills/:section', (req, res) => {
  const section = getSection(req)
  assertSkillsUnused(section.skills.map(s => s.id))
  sections.splice(sections.indexOf(section), 1)
  res.status(204).end()
})

admin.post('/skills/:section/skills', (req, res) => {
  const section = getSection(req)
  assertNoEmptyStrings(req.body)
  assertRequired(req.body, ['id', ...SKILL_FIELDS])
  if (allSkillIds().has(req.body.id)) throw new HttpError(409, `Skill id "${req.body.id}" already exists`)
  section.skills.push(req.body as Skill)
  res.status(201).json(req.body)
})

function findSkillIndex(section: Section, id: string) {
  const idx = section.skills.findIndex(s => s.id === id)
  if (idx === -1) throw new HttpError(404, `No skill with id "${id}" in this section`)
  return idx
}

admin.put('/skills/:section/skills/:id', (req, res) => {
  const section = getSection(req)
  const id = req.params.id as string
  const idx = findSkillIndex(section, id)
  assertNoEmptyStrings(req.body)
  assertRequired(req.body, SKILL_FIELDS)
  section.skills[idx] = { ...req.body, id }
  res.json(section.skills[idx])
})

admin.patch('/skills/:section/skills/:id', (req, res) => {
  const section = getSection(req)
  const id = req.params.id as string
  const idx = findSkillIndex(section, id)
  assertNoEmptyStrings(req.body)
  section.skills[idx] = { ...section.skills[idx], ...req.body, id }
  res.json(section.skills[idx])
})

admin.delete('/skills/:section/skills/:id', (req, res) => {
  const section = getSection(req)
  const id = req.params.id as string
  const idx = findSkillIndex(section, id)
  assertSkillsUnused([id])
  section.skills.splice(idx, 1)
  res.status(204).end()
})

// ------------------------------------------------------------------ generic collections
interface CollectionOptions {
  required: string[]
  validate?: (item: Record<string, unknown>) => void
}

function collectionRouter<T extends { id: string }>(name: string, getItems: () => T[], options: CollectionOptions) {
  const router = express.Router()

  const findIndex = (id: string) => {
    const idx = getItems().findIndex(i => i.id === id)
    if (idx === -1) throw new HttpError(404, `No item with id "${id}" in ${name}`)
    return idx
  }
  const check = (item: Record<string, unknown>) => {
    assertNoEmptyStrings(item)
    assertRequired(item, options.required)
    options.validate?.(item)
  }

  router.get('/', (_req, res) => {
    res.json(getItems())
  })
  router.post('/', (req, res) => {
    check(req.body)
    assertRequired(req.body, ['id'])
    if (getItems().some(i => i.id === req.body.id)) throw new HttpError(409, `An item with id "${req.body.id}" already exists in ${name}`)
    getItems().push(req.body)
    res.status(201).json(req.body)
  })
  router.get('/:id', (req, res) => {
    res.json(getItems()[findIndex(req.params.id as string)])
  })
  router.put('/:id', (req, res) => {
    const id = req.params.id as string
    const idx = findIndex(id)
    check(req.body)
    getItems()[idx] = { ...req.body, id }
    res.json(getItems()[idx])
  })
  router.patch('/:id', (req, res) => {
    const id = req.params.id as string
    const idx = findIndex(id)
    assertNoEmptyStrings(req.body)
    const merged: Record<string, unknown> = { ...getItems()[idx], ...req.body, id }
    options.validate?.(merged)
    getItems()[idx] = merged as unknown as T
    res.json(merged)
  })
  router.delete('/:id', (req, res) => {
    getItems().splice(findIndex(req.params.id as string), 1)
    res.status(204).end()
  })
  return router
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertEnum(value: unknown, allowed: string[], field: string) {
  if (!allowed.includes(value as string)) throw new HttpError(400, `body.${field} must be one of ${allowed.join(', ')}`)
}

admin.use(
  '/experiences',
  collectionRouter('experiences', () => experiences, {
    required: ['type', 'title', 'organization', 'startDate', 'endDate', 'workload', 'highlights', 'tags'],
    validate: item => {
      assertEnum(item.type, ['job', 'internship', 'association'], 'type')
      assertEnum(item.workload, ['full-time', 'part-time', 'volunteer'], 'workload')
      if (!DATE_RE.test(item.startDate as string)) throw new HttpError(400, 'body.startDate must be a date formatted as YYYY-MM-DD')
      if (item.endDate !== null && !DATE_RE.test(item.endDate as string)) throw new HttpError(400, 'body.endDate must be a date formatted as YYYY-MM-DD or null')
      const org = item.organization as Record<string, unknown>
      assertRequired(org, ['name', 'location'])
    },
  }),
)
admin.use('/interests', collectionRouter('interests', () => interests, { required: ['title', 'icon', 'description', 'tags'] }))

// ------------------------------------------------------------------ app
function requireToken(req: Request, res: Response, next: NextFunction) {
  if (req.get('authorization') !== `Bearer ${MOCK_TOKEN}`) {
    res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

const app = express()
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  setTimeout(next, LATENCY_MS)
})
app.use('/admin', requireToken, express.json({ limit: '1mb' }), admin)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) res.status(err.status).json({ error: err.message })
  else if (err instanceof SyntaxError) res.status(400).json({ error: 'Malformed JSON' })
  else {
    console.error(err)
    res.status(500).json({ error: 'Internal error' })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Portfolio mock listening on http://127.0.0.1:${PORT} (token: ${MOCK_TOKEN})`)
})
