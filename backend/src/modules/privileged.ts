import { spawn } from 'child_process'

/**
 * Path of the root-owned helper script (deploy/admin-panel-helper), the only command the backend
 * is allowed to run with sudo.
 */
export const HELPER_PATH: string = process.env.PRIVILEGED_HELPER || '/usr/local/sbin/admin-panel-helper'

const DEFAULT_TIMEOUT_MS: number = 30_000

export interface HelperResult {
    stdout: string
    stderr: string
}

/** Carries the helper output, like the errors of child_process.execFile. */
export class HelperError extends Error {
    public constructor(message: string, public readonly code: number | null, public readonly stdout: string, public readonly stderr: string) {
        super(message)
    }
}

export interface HelperOptions {
    /** Written to the helper's stdin (e.g. the content of `vhost-write`) */
    input?: string
    timeoutMs?: number
}

/** Runs `sudo -n <helper> <args...>` without a shell. Rejects with a HelperError on a non-zero exit. */
export function runHelper(args: string[], options: HelperOptions = {}): Promise<HelperResult> {
    return new Promise((resolve, reject) => {
        // -n: fail instead of waiting for a password if sudoers is not set up
        const child = spawn('sudo', ['-n', HELPER_PATH, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
        child.on('error', (error: Error) => {
            clearTimeout(timer)
            reject(new HelperError(error.message, null, stdout, error.message))
        })
        child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
            clearTimeout(timer)
            if (code === 0) {
                resolve({ stdout, stderr })
                return
            }
            const reason = signal ? `killed by ${signal} (timeout?)` : `exit code ${code}`
            reject(new HelperError(`${HELPER_PATH} ${args[0] ?? ''} failed: ${reason}`, code, stdout, stderr || reason))
        })

        child.stdin.end(options.input ?? '')
    })
}
