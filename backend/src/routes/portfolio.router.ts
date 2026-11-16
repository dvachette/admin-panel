import { Router, type Response } from 'express'
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
  PortfolioApiError,
  listExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  listInterests,
  createInterest,
  updateInterest,
  deleteInterest,
  type Experience,
  type Interest,
} from '../modules/portfolio.module'

export const portfolioRouter = Router()

function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof PortfolioApiError) {
    res.status(err.status).json({ error: err.message })
  } else {
    res.status(500).json({ error: fallback })
  }
}

portfolioRouter.get('/projects', async (req, res) => {
  try {
    const projects = await listProjects()
    res.json(projects)
  } catch (err) {
    sendError(res, err, 'Failed to list projects')
  }
})

portfolioRouter.post('/projects', async (req, res) => {
  try {
    await createProject(req.body as Project)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.put('/projects/:id', async (req, res) => {
  try {
    await updateProject(req.params.id, req.body as Project)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.delete('/projects/:id', async (req, res) => {
  try {
    await deleteProject(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.get('/sections', async (req, res) => {
  try {
    const sections = await listSections()
    res.json(sections)
  } catch (err) {
    sendError(res, err, 'Failed to list sections')
  }
})

portfolioRouter.post('/sections', async (req, res) => {
  try {
    await createSection(req.body as Section)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.put('/sections/:index', async (req, res) => {
  try {
    await updateSection(parseInt(req.params.index), req.body as Partial<Section>)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.delete('/sections/:index', async (req, res) => {
  try {
    await deleteSection(parseInt(req.params.index))
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.post('/sections/:index/skills', async (req, res) => {
  try {
    await createSkill(parseInt(req.params.index), req.body as Skill)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.put('/sections/:index/skills/:id', async (req, res) => {
  try {
    await updateSkill(parseInt(req.params.index), req.params.id, req.body as Skill)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.delete('/sections/:index/skills/:id', async (req, res) => {
  try {
    await deleteSkill(parseInt(req.params.index), req.params.id)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.get('/experiences', async (req, res) => {
  try {
    res.json(await listExperiences())
  } catch (err) {
    sendError(res, err, 'Failed to list experiences')
  }
})

portfolioRouter.post('/experiences', async (req, res) => {
  try {
    await createExperience(req.body as Experience)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.put('/experiences/:id', async (req, res) => {
  try {
    await updateExperience(req.params.id, req.body as Experience)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.delete('/experiences/:id', async (req, res) => {
  try {
    await deleteExperience(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.get('/interests', async (req, res) => {
  try {
    res.json(await listInterests())
  } catch (err) {
    sendError(res, err, 'Failed to list interests')
  }
})

portfolioRouter.post('/interests', async (req, res) => {
  try {
    await createInterest(req.body as Interest)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.put('/interests/:id', async (req, res) => {
  try {
    await updateInterest(req.params.id, req.body as Interest)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
  }
})

portfolioRouter.delete('/interests/:id', async (req, res) => {
  try {
    await deleteInterest(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    sendError(res, err, 'Portfolio API request failed')
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
