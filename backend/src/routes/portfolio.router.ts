import { Router } from 'express'
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  createSkill,
  updateSkill,
  deleteSkill,
  type Section,
  type Skill,
  type Project,
  listImages,
  uploadImage,
} from '../modules/portfolio.module'

export const portfolioRouter = Router()

portfolioRouter.get('/projects', async (req, res) => {
  try {
    const projects = await listProjects()
    res.json(projects)
  } catch {
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

portfolioRouter.post('/projects', async (req, res) => {
  try {
    await createProject(req.body as Project)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

portfolioRouter.put('/projects/:id', async (req, res) => {
  try {
    await updateProject(req.params.id, req.body as Partial<Project>)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

portfolioRouter.delete('/projects/:id', async (req, res) => {
  try {
    await deleteProject(req.params.id)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

portfolioRouter.get('/sections', async (req, res) => {
  try {
    const sections = await listSections()
    res.json(sections)
  } catch {
    res.status(500).json({ error: 'Failed to list sections' })
  }
})

portfolioRouter.post('/sections', async (req, res) => {
  try {
    await createSection(req.body as Section)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

portfolioRouter.put('/sections/:index', async (req, res) => {
  try {
    await updateSection(parseInt(req.params.index), req.body as Partial<Section>)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

portfolioRouter.delete('/sections/:index', async (req, res) => {
  try {
    await deleteSection(parseInt(req.params.index))
    res.json({ ok: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

portfolioRouter.post('/sections/:index/skills', async (req, res) => {
  try {
    await createSkill(parseInt(req.params.index), req.body as Skill)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

portfolioRouter.put('/sections/:index/skills/:id', async (req, res) => {
  try {
    await updateSkill(parseInt(req.params.index), req.params.id, req.body as Partial<Skill>)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

portfolioRouter.delete('/sections/:index/skills/:id', async (req, res) => {
  try {
    await deleteSkill(parseInt(req.params.index), req.params.id)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

portfolioRouter.get('/images', async (req, res) => {
  try {
    const images = await listImages()
    res.json(images)
  } catch {
    res.status(500).json({ error: 'Failed to list images' })
  }
})

portfolioRouter.post('/images', uploadImage.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  res.json({ filename: req.file.originalname })
})
