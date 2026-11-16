import axios from 'axios'
import type {
  Certificate,
  SecureResult,
  Vhost,
  VhostConfig,
  VhostCreateResult,
  VhostUpdate,
  VhostUpdateResult,
} from '@/types/nginxTypes'

async function getStatus() {
  return await axios.get('/api/nginx/status', { withCredentials: true })
}


async function getVhosts() {
  return await axios.get<Vhost[]>('/api/nginx/vhosts', { withCredentials: true })
}

async function startNginx() {
  await axios.post('/api/nginx/start', {}, { withCredentials: true })
}

async function stopNginx() {
  await axios.post('/api/nginx/stop', {}, { withCredentials: true })
}

async function reloadNginx() {
  await axios.post('/api/nginx/reload', {}, { withCredentials: true })
}

async function enableVhost(name: string) {
  await axios.post(`/api/nginx/vhosts/${name}/enable`, {}, { withCredentials: true })
  await reloadNginx()
}

async function disableVhost(name: string) {
  await axios.post(`/api/nginx/vhosts/${name}/disable`, {}, { withCredentials: true })
  await reloadNginx()
}

async function deleteVhost(name: string) {
  await axios.delete(`/api/nginx/vhosts/${name}`, { withCredentials: true })
  await reloadNginx()
}

async function createVhost(cfg: VhostConfig): Promise<VhostCreateResult> {
  const { data } = await axios.post<VhostCreateResult>('/api/nginx/vhosts', cfg, {
    withCredentials: true,
  })
  await reloadNginx()
  return data
}

async function getCertificates() {
  return await axios.get<Certificate[]>('/api/nginx/certificates', { withCredentials: true })
}

/** Installs HTTPS on the vhost with certbot (existing covering certificate, or a new one). */
async function secureVhost(name: string): Promise<SecureResult> {
  const { data } = await axios.post<SecureResult>(
    `/api/nginx/vhosts/${encodeURIComponent(name)}/certificate`,
    {},
    { withCredentials: true }
  )
  await reloadNginx()
  return data
}
async function updateVhost(name: string, update: VhostUpdate): Promise<VhostUpdateResult> {
  const { data } = await axios.put<VhostUpdateResult>(
    `/api/nginx/vhosts/${encodeURIComponent(name)}`,
    update,
    { withCredentials: true }
  )
  await reloadNginx()
  return data
}
export function useNginxService() {
  return {
    updateVhost,
    getStatus,
    getVhosts,
    startNginx,
    stopNginx,
    reloadNginx,
    enableVhost,
    disableVhost,
    deleteVhost,
    createVhost,
    getCertificates,
    secureVhost,
  }
}
