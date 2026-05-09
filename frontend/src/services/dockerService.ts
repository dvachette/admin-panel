import axios from 'axios'

function getStatsStream(id: string): EventSource {
  return new EventSource(`/api/docker/containers/${id}/stats`, { withCredentials: true })
}

async function deleteContainer(id: string): Promise<void> {
  await axios.delete(`/api/docker/containers/${id}`, { withCredentials: true })
}

async function getContainers() {
  return await axios.get('/api/docker/containers', { withCredentials: true })
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
  }
}
