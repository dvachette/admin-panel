import fs from "fs/promises";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const SAMPLE_INTERVAL_MS = 2_000;
/** 5 minutes of history at one sample every 2 s */
const HISTORY_SIZE = 150;
/** The sampler stops when nobody has asked for metrics for that long */
const IDLE_STOP_MS = 60_000;
/** Real filesystems shown in the disks card (no overlay/tmpfs/squashfs...) */
const DISK_FS_TYPES = new Set(["ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "vfat", "exfat", "ntfs3"]);
/** Virtual interfaces left out of the network throughput */
const VIRTUAL_IFACE_REGEX = /^(lo|docker\d*|br-|veth|virbr|vnet|tun|tap|wg)/;

export interface MetricsSample {
    /** Unix time (ms) */
    time: number;
    cpuPercent: number;
    memUsed: number;
    memTotal: number;
    swapUsed: number;
    swapTotal: number;
    /** Bytes per second, all physical interfaces */
    netRx: number;
    netTx: number;
    load1: number;
}

export interface Disk {
    mount: string;
    device: string;
    fsType: string;
    total: number;
    used: number;
    available: number;
}

export interface SystemMetrics {
    host: {
        hostname: string;
        os: string;
        kernel: string;
        cpus: number;
        uptime: number;
        load: [number, number, number];
    };
    current: MetricsSample | null;
    history: MetricsSample[];
    disks: Disk[];
}

interface CpuTimes {
    busy: number;
    total: number;
}

interface NetCounters {
    rx: number;
    tx: number;
    time: number;
}

async function readCpuTimes(): Promise<CpuTimes> {
    const line = (await fs.readFile("/proc/stat", "utf-8")).split("\n")[0];
    // cpu user nice system idle iowait irq softirq steal guest guest_nice
    const values = line.trim().split(/\s+/).slice(1, 9).map(Number);
    const total = values.reduce((sum, v) => sum + v, 0);
    const idle = values[3] + values[4];
    return { busy: total - idle, total };
}

async function readMemInfo(): Promise<Record<string, number>> {
    const info: Record<string, number> = {};
    for (const line of (await fs.readFile("/proc/meminfo", "utf-8")).split("\n")) {
        const match = line.match(/^(\w+):\s+(\d+)\s*kB/);
        if (match) info[match[1]] = Number(match[2]) * 1024;
    }
    return info;
}

async function readNetCounters(): Promise<NetCounters> {
    let rx = 0;
    let tx = 0;
    for (const line of (await fs.readFile("/proc/net/dev", "utf-8")).split("\n").slice(2)) {
        const match = line.match(/^\s*([^:]+):\s*(.*)$/);
        if (!match || VIRTUAL_IFACE_REGEX.test(match[1])) continue;
        const fields = match[2].trim().split(/\s+/).map(Number);
        rx += fields[0];
        tx += fields[8];
    }
    return { rx, tx, time: Date.now() };
}

// ------------------------------------------------------------------ sampler

const history: MetricsSample[] = [];
let timer: NodeJS.Timeout | null = null;
let lastRequest = 0;
let previousCpu: CpuTimes | null = null;
let previousNet: NetCounters | null = null;

async function takeSample(): Promise<void> {
    const [cpu, mem, net] = await Promise.all([readCpuTimes(), readMemInfo(), readNetCounters()]);
    if (previousCpu && previousNet) {
        const cpuDelta = cpu.total - previousCpu.total;
        const seconds = Math.max((net.time - previousNet.time) / 1000, 0.001);
        history.push({
            time: Date.now(),
            cpuPercent: cpuDelta > 0 ? Math.round(((cpu.busy - previousCpu.busy) / cpuDelta) * 1000) / 10 : 0,
            memTotal: mem.MemTotal ?? 0,
            memUsed: (mem.MemTotal ?? 0) - (mem.MemAvailable ?? 0),
            swapTotal: mem.SwapTotal ?? 0,
            swapUsed: (mem.SwapTotal ?? 0) - (mem.SwapFree ?? 0),
            netRx: Math.max(0, Math.round((net.rx - previousNet.rx) / seconds)),
            netTx: Math.max(0, Math.round((net.tx - previousNet.tx) / seconds)),
            load1: os.loadavg()[0],
        });
        if (history.length > HISTORY_SIZE) history.splice(0, history.length - HISTORY_SIZE);
    }
    previousCpu = cpu;
    previousNet = net;
}

function tick(): void {
    if (Date.now() - lastRequest > IDLE_STOP_MS) {
        stopSampler();
        return;
    }
    takeSample().catch((err) => console.error("metrics sample failed", err));
}

function stopSampler(): void {
    if (timer) clearInterval(timer);
    timer = null;
    previousCpu = null;
    previousNet = null;
}

/** Starts sampling on demand (the first call waits for a first measurement). */
async function ensureSampler(): Promise<void> {
    lastRequest = Date.now();
    if (timer) return;
    history.length = 0;
    await takeSample();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await takeSample();
    timer = setInterval(tick, SAMPLE_INTERVAL_MS);
}

// ------------------------------------------------------------------ disks, host

async function listDisks(): Promise<Disk[]> {
    const seen = new Set<string>();
    const disks: Disk[] = [];
    for (const line of (await fs.readFile("/proc/mounts", "utf-8")).split("\n")) {
        const [device, mount, fsType] = line.split(" ");
        if (!device || !DISK_FS_TYPES.has(fsType) || seen.has(device)) continue;
        // Mount points are octal-escaped in /proc/mounts (e.g. \040 for a space)
        const path = mount.replace(/\\(\d{3})/g, (_m, oct: string) => String.fromCharCode(parseInt(oct, 8)));
        if (path.startsWith("/var/lib/docker") || path.startsWith("/snap")) continue;
        try {
            const stats = await fs.statfs(path);
            const total = stats.blocks * stats.bsize;
            if (total === 0) continue;
            seen.add(device);
            disks.push({
                mount: path,
                device,
                fsType,
                total,
                used: (stats.blocks - stats.bfree) * stats.bsize,
                available: stats.bavail * stats.bsize,
            });
        } catch {
            // Unreadable mount point (permissions): skipped
        }
    }
    return disks.sort((a, b) => a.mount.localeCompare(b.mount));
}

let osName: string | null = null;

async function readOsName(): Promise<string> {
    if (osName) return osName;
    try {
        const content = await fs.readFile("/etc/os-release", "utf-8");
        osName = content.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] ?? os.type();
    } catch {
        osName = os.type();
    }
    return osName;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    await ensureSampler();
    const load = os.loadavg();
    return {
        host: {
            hostname: os.hostname(),
            os: await readOsName(),
            kernel: os.release(),
            cpus: os.cpus().length,
            uptime: Math.round(os.uptime()),
            load: [load[0], load[1], load[2]],
        },
        current: history[history.length - 1] ?? null,
        history,
        disks: await listDisks(),
    };
}

// ------------------------------------------------------------------ listening ports

export interface ListeningPort {
    proto: "tcp" | "udp";
    address: string;
    port: number;
    /** Bound to a loopback address only: not reachable from outside */
    loopback: boolean;
}

function isLoopback(address: string): boolean {
    return address.startsWith("127.") || address === "::1" || address === "localhost";
}

/** `ss -ltunH` (no root needed without -p): listening TCP sockets and bound UDP sockets. */
export async function listListeningPorts(): Promise<ListeningPort[]> {
    const { stdout } = await execFileAsync("ss", ["-ltunH"]);
    const ports = new Map<string, ListeningPort>();
    for (const line of stdout.split("\n")) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 5) continue;
        const proto = fields[0] === "tcp" ? "tcp" : fields[0] === "udp" ? "udp" : null;
        const match = fields[4].match(/^\[?(.*?)\]?(?:%\S+)?:(\d+)$/);
        if (!proto || !match) continue;
        const address = match[1] === "*" ? "0.0.0.0" : match[1];
        const port = Number(match[2]);
        const key = `${proto}/${port}/${address}`;
        ports.set(key, { proto, address, port, loopback: isLoopback(address) });
    }
    return [...ports.values()].sort((a, b) => a.port - b.port || a.proto.localeCompare(b.proto) || a.address.localeCompare(b.address));
}
