import axios from 'axios'
import type { Container } from '@/types/dockerTypes'

/** One SSE connection for all the given containers (events carry the container id) */
function getStatsStream(ids: string[]): EventSource {
  const query = encodeURIComponent(ids.join(','))
  return new EventSource(`/api/docker/stats?ids=${query}`, { withCredentials: true })
}

async function deleteContainer(id: string): Promise<void> {
  await axios.delete(`/api/docker/containers/${id}`, { withCredentials: true })
}

async function getContainers() {
  return await axios.get<Container[]>('/api/docker/containers', { withCredentials: true })
}

async function restartContainer(id: string) {
  await axios.post(`/api/docker/containers/${id}/restart`, {}, { withCredentials: true })
}

async function getLogs(id: string, tail: number): Promise<string> {
  const { data } = await axios.get<{ logs: string }>(`/api/docker/containers/${id}/logs`, {
    params: { tail },
    withCredentials: true,
  })
  return data.logs
}

async function startContainer(id: string) {
  await axios.post(`/api/docker/containers/${id}/start`, {}, { withCredentials: true })
}

async function stopContainer(id: string) {
  await axios.post(`/api/docker/containers/${id}/stop`, {}, { withCredentials: true })
}
export function useDockerService() {
  return {
    getStatsStream,
    deleteContainer,
    getContainers,
    startContainer,
    stopContainer,
    restartContainer,
    getLogs,
  }
}
