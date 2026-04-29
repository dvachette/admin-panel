import { Router } from 'express'
import {
    getNginxStatus,
    startNginx,
    stopNginx,
    reloadNginx,
    listVhosts,
    enableVhost,
    disableVhost,
    deleteVhost,
    createVhost,
    type VhostConfig,
} from '../modules/nginx.module'

export const nginxRouter = Router()

nginxRouter.get('/status', async (req, res) => {
    try {
        const status = await getNginxStatus()
        res.json({ status })
    } catch {
        res.status(500).json({ error: 'Failed to get nginx status' })
    }
})

nginxRouter.post('/start', async (req, res) => {
    try {
        await startNginx()
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to start nginx' })
    }
})

nginxRouter.post('/stop', async (req, res) => {
    try {
        await stopNginx()
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to stop nginx' })
    }
})

nginxRouter.post('/reload', async (req, res) => {
    try {
        await reloadNginx()
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to reload nginx' })
    }
})

nginxRouter.get('/vhosts', async (req, res) => {
    try {
        const vhosts = await listVhosts()
        res.json(vhosts)
    } catch {
        res.status(500).json({ error: 'Failed to list vhosts' })
    }
})

nginxRouter.post('/vhosts', async (req, res) => {
    try {
        await createVhost(req.body as VhostConfig)
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to create vhost' })
    }
})

nginxRouter.post('/vhosts/:name/enable', async (req, res) => {
    try {
        await enableVhost(req.params.name)
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to enable vhost' })
    }
})

nginxRouter.post('/vhosts/:name/disable', async (req, res) => {
    try {
        await disableVhost(req.params.name)
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to disable vhost' })
    }
})

nginxRouter.delete('/vhosts/:name', async (req, res) => {
    try {
        await deleteVhost(req.params.name)
        res.json({ ok: true })
    } catch {
        res.status(500).json({ error: 'Failed to delete vhost' })
    }
})