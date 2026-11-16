import { Router, type Response } from "express";
import {
    listContainers,
    startContainer,
    stopContainer,
    restartContainer,
    streamContainerStats,
    removeContainer,
    getContainerLogs,
    DockerError,
} from "../modules/docker.module";

export const dockerRouter = Router();

function sendError(res: Response, err: unknown, fallback: string) {
    if (err instanceof DockerError) {
        res.status(err.status).json({ error: err.message });
    } else {
        console.error(err);
        res.status(500).json({ error: fallback });
    }
}

dockerRouter.get("/containers", async (req, res) => {
    try {
        const containers = await listContainers();
        res.json(containers);
    } catch (err) {
        sendError(res, err, "Failed to list containers");
    }
});

dockerRouter.post("/containers/:id/start", async (req, res) => {
    try {
        await startContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, "Failed to start container");
    }
});

dockerRouter.post("/containers/:id/stop", async (req, res) => {
    try {
        await stopContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, "Failed to stop container");
    }
});

dockerRouter.post("/containers/:id/restart", async (req, res) => {
    try {
        await restartContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, "Failed to restart container");
    }
});

dockerRouter.get("/containers/:id/logs", async (req, res) => {
    try {
        const logs = await getContainerLogs(req.params.id, Number(req.query.tail ?? 200));
        res.json({ logs });
    } catch (err) {
        sendError(res, err, "Failed to read container logs");
    }
});

const CONTAINER_REF_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const MAX_STATS_STREAMS = 50;

/**
 * Live CPU / RAM of several containers over a single SSE connection (`?ids=a,b,c`): one stream per
 * container would exhaust the browser's 6 HTTP/1.1 connections per host and block the page.
 */
dockerRouter.get("/stats", async (req, res) => {
    const ids = [...new Set(String(req.query.ids ?? "").split(",").filter(Boolean))];
    if (ids.length === 0 || ids.length > MAX_STATS_STREAMS || !ids.every((id) => CONTAINER_REF_REGEX.test(id))) {
        res.status(400).json({ error: `ids: 1 to ${MAX_STATS_STREAMS} container ids, comma separated` });
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    await Promise.all(ids.map((id) =>
        streamContainerStats(id, (stats) => {
            res.write(`data: ${JSON.stringify({ id, ...stats })}\n\n`);
        }, controller.signal).catch(() => {
            // Stopped or removed container: the others keep streaming
            res.write(`data: ${JSON.stringify({ id, error: true })}\n\n`);
        })
    ));
});

dockerRouter.delete("/containers/:id", async (req, res) => {
    try {
        await removeContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, err, "Failed to remove container");
    }
});
