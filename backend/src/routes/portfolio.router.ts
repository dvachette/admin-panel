import { Router } from 'express'
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listUEs,
  updateUELevel,
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

portfolioRouter.get('/ues', async (req, res) => {
  try {
    const ues = await listUEs()
    res.json(ues)
  } catch {
    res.status(500).json({ error: 'Failed to list UEs' })
  }
})

portfolioRouter.patch('/ues/:id/level', async (req, res) => {
  try {
    const { level } = req.body
    if (typeof level !== 'number') {
      res.status(400).json({ error: 'level must be a number' })
      return
    }
    await updateUELevel(req.params.id, level)
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
