import Dockerode from "dockerode";
import { Readable } from "stream";

/**
 * DOCKER_HOST=tcp://127.0.0.1:2375 goes through the filtering socket proxy
 * (deploy/docker-socket-proxy); otherwise the socket is used directly (local development).
 */
function createClient(): Dockerode {
    const host = process.env.DOCKER_HOST;
    if (host?.startsWith("tcp://")) {
        const url = new URL(host.replace(/^tcp:/, "http:"));
        return new Dockerode({ host: url.hostname, port: Number(url.port || 2375), protocol: "http" });
    }
    return new Dockerode({ socketPath: host?.startsWith("unix://") ? host.slice("unix://".length) : "/var/run/docker.sock" });
}

const docker = createClient();

export class DockerError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

/** Turns a dockerode error into a DockerError carrying Docker's own message and status. */
function toDockerError(err: unknown, fallback: string): DockerError {
    if (err instanceof DockerError) return err;
    const e = err as { statusCode?: number; json?: { message?: string }; reason?: string; message?: string };
    const status = e?.statusCode && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500;
    return new DockerError(status, e?.json?.message ?? e?.reason ?? e?.message ?? fallback);
}

export type Health = "healthy" | "unhealthy" | "starting" | null;

export interface ContainerPort {
    /** Host IPs the port is bound to (IPv4 and IPv6 bindings are merged) */
    ips: string[];
    privatePort: number;
    publicPort?: number;
    type: string;
}

function parseHealth(status: string): Health {
    if (status.includes("(healthy)")) return "healthy";
    if (status.includes("(unhealthy)")) return "unhealthy";
    if (status.includes("(health: starting)")) return "starting";
    return null;
}

function mergePorts(ports: Dockerode.Port[]): ContainerPort[] {
    const merged = new Map<string, ContainerPort>();
    for (const p of ports) {
        const key = `${p.PublicPort ?? ""}:${p.PrivatePort}/${p.Type}`;
        const entry = merged.get(key) ?? { ips: [], privatePort: p.PrivatePort, publicPort: p.PublicPort, type: p.Type };
        if (p.IP && !entry.ips.includes(p.IP)) entry.ips.push(p.IP);
        merged.set(key, entry);
    }
    return [...merged.values()].sort((a, b) => (a.publicPort ?? 0) - (b.publicPort ?? 0) || a.privatePort - b.privatePort);
}

export async function listContainers() {
    const containers = await docker.listContainers({ all: true });
    return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0].replace("/", ""),
        image: c.Image,
        status: c.Status,
        state: c.State,
        health: parseHealth(c.Status),
        /** Unix timestamp (s) */
        created: c.Created,
        project: c.Labels["com.docker.compose.project"] ?? null,
        service: c.Labels["com.docker.compose.service"] ?? null,
        ports: mergePorts(c.Ports),
    }));
}

export async function startContainer(id: string) {
    try {
        await docker.getContainer(id).start();
    } catch (err) {
        throw toDockerError(err, "Failed to start container");
    }
}

export async function stopContainer(id: string) {
    try {
        await docker.getContainer(id).stop();
    } catch (err) {
        throw toDockerError(err, "Failed to stop container");
    }
}

export async function restartContainer(id: string) {
    try {
        await docker.getContainer(id).restart();
    } catch (err) {
        throw toDockerError(err, "Failed to restart container");
    }
}

export async function removeContainer(id: string) {
    const container = docker.getContainer(id);
    try {
        const info = await container.inspect();
        if (info.State.Running) {
            throw new DockerError(409, "Le conteneur tourne : arrêtez-le avant de le supprimer");
        }
        await container.remove();
    } catch (err) {
        throw toDockerError(err, "Failed to remove container");
    }
}

/**
 * Non-TTY logs are multiplexed: each frame is an 8-byte header (stream type, 3 zero bytes,
 * big-endian payload size) followed by the payload.
 */
function demuxLogs(buffer: Buffer): string {
    const parts: Buffer[] = [];
    let offset = 0;
    while (offset + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(offset + 4);
        parts.push(buffer.subarray(offset + 8, offset + 8 + size));
        offset += 8 + size;
    }
    return Buffer.concat(parts).toString("utf-8");
}

const MAX_LOG_LINES = 2000;

export async function getContainerLogs(id: string, tail: number): Promise<string> {
    const lines = Math.min(Math.max(Math.trunc(tail) || 200, 1), MAX_LOG_LINES);
    const container = docker.getContainer(id);
    try {
        const info = await container.inspect();
        const raw = (await container.logs({ stdout: true, stderr: true, tail: lines, timestamps: true, follow: false })) as unknown as Buffer;
        return info.Config.Tty ? raw.toString("utf-8") : demuxLogs(raw);
    } catch (err) {
        throw toDockerError(err, "Failed to read container logs");
    }
}

export async function streamContainerStats(id: string, onData: (stats: object) => void, signal: AbortSignal) {
    const container = docker.getContainer(id);
    const stream = await container.stats({ stream: true }) as Readable;

    signal.addEventListener("abort", () => stream.destroy());

    // The stream is newline-delimited JSON, but chunks are not aligned on lines
    let pending = "";
    stream.on("data", (chunk: Buffer) => {
        pending += chunk.toString();
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const raw = JSON.parse(line);
                const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - (raw.precpu_stats.cpu_usage?.total_usage ?? 0);
                const systemDelta = raw.cpu_stats.system_cpu_usage - (raw.precpu_stats.system_cpu_usage ?? 0);
                const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * raw.cpu_stats.online_cpus * 100 : 0;
                const memUsage = raw.memory_stats.usage;
                const memLimit = raw.memory_stats.limit;

                onData({
                    cpu: parseFloat(cpuPercent.toFixed(2)),
                    memUsage,
                    memLimit,
                    memPercent: parseFloat(((memUsage / memLimit) * 100).toFixed(2)),
                });
            } catch { }
        }
    });
}
