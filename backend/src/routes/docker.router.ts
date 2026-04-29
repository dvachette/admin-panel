import { Router } from "express";
import { listContainers, startContainer, stopContainer, streamContainerStats, removeContainer } from "../modules/docker.module";

export const dockerRouter = Router();

dockerRouter.get("/containers", async (req, res) => {
    try {
        const containers = await listContainers();
        res.json(containers);
    } catch (err) {
        res.status(500).json({ error: "Failed to list containers" });
    }
});

dockerRouter.post("/containers/:id/start", async (req, res) => {
    try {
        await startContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to start container" });
    }
});

dockerRouter.post("/containers/:id/stop", async (req, res) => {
    try {
        await stopContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to stop container" });
    }
});

dockerRouter.get("/containers/:id/stats", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    try {
        await streamContainerStats(req.params.id, (stats) => {
            res.write(`data: ${JSON.stringify(stats)}\n\n`);
        }, controller.signal);
    } catch (err) {
        res.end();
    }
});

dockerRouter.delete("/containers/:id", async (req, res) => {
    try {
        await removeContainer(req.params.id);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: "Failed to remove container" });
    }
});