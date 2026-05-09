import axios from "axios"
async function getStatus() {
    return await axios.get('/api/nginx/status', { withCredentials: true })
}

async function getVhosts() {
    return await axios.get('/api/nginx/vhosts', { withCredentials: true })
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
}

async function disableVhost(name: string) {
    await axios.post(`/api/nginx/vhosts/${name}/disable`, {}, { withCredentials: true })
}

async function deleteVhost(name:string) {
    await axios.delete(`/api/nginx/vhosts/${name}`, { withCredentials: true })
}

async function createVhost(cfg: object) {
    await axios.post('/api/nginx/vhosts', cfg, { withCredentials: true })
}

export function useNginxService() {
    return {
        getStatus,
        getVhosts,
        startNginx,
        stopNginx,
        reloadNginx,
        enableVhost,
        disableVhost,
        deleteVhost,
        createVhost
    }
}