import Dockerode from "dockerode";
import { Readable } from "stream";

const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

export async function listContainers() {
    const containers = await docker.listContainers({ all: true });
    return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0].replace("/", ""),
        image: c.Image,
        status: c.Status,
        state: c.State,
        ports: c.Ports.map((p) => ({
            ip: p.IP,
            privatePort: p.PrivatePort,
            publicPort: p.PublicPort,
            type: p.Type,
        }))
    }));
}

export async function startContainer(id: string) {
    const container = docker.getContainer(id);
    await container.start();
}

export async function stopContainer(id: string) {
    const container = docker.getContainer(id);
    await container.stop();
}

export async function streamContainerStats(id: string, onData: (stats: object) => void, signal: AbortSignal) {
    const container = docker.getContainer(id);
    const stream = await container.stats({ stream: true }) as Readable;

    signal.addEventListener("abort", () => stream.destroy());

    stream.on("data", (chunk: Buffer) => {
        try {
            const raw = JSON.parse(chunk.toString());
            const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage;
            const systemDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage;
            const cpuPercent = (cpuDelta / systemDelta) * raw.cpu_stats.online_cpus * 100;
            const memUsage = raw.memory_stats.usage;
            const memLimit = raw.memory_stats.limit;

            onData({
                cpu: parseFloat(cpuPercent.toFixed(2)),
                memUsage,
                memLimit,
                memPercent: parseFloat(((memUsage / memLimit) * 100).toFixed(2)),
            });
        } catch { }
    });
}