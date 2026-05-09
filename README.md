# Admin Panel

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ed?logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-bare--metal-009639?logo=nginx&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

VPS administration panel — Vue 3 + TypeScript + Express.

## Features

### Docker
- List containers (name, image, state, status, ports)
- Start / stop / remove a container
- Live CPU / RAM stats per container (SSE)

### Nginx
- Service status (active / inactive)
- Start / stop / reload nginx
- List virtual hosts (enabled / disabled)
- Create a virtual host (proxy or static mode, with or without SSL)
- Enable / disable / delete a virtual host

### Portfolio
- List, create, edit and delete projects
- Edit competence levels (UEs)

## Architecture

```
admin-panel/
├── backend/         # Express + TypeScript, bare-metal (systemd)
└── frontend/        # Vue 3 + Vite + PrimeVue, containerized (Docker)
```

- **Frontend**: served by Apache in a Docker container, configurable port
- **Backend**: systemd service, configurable port
- **Bare-metal Nginx**: reverse proxy to the configured domain, routes `/api/` to the backend and `/` to the frontend

## Requirements

On the server:
- Node.js 18+
- Docker + Docker Compose
- Bare-metal Nginx
- Certbot
- A non-root sudoer user

## Installation

### 1. Clone the repository

```bash
git clone <repo_url> /opt/admin-panel
cd /opt/admin-panel
```

### 2. Backend

```bash
cd backend
npm install
npm run build
```

Create the `.env` file from the template:

```bash
cp .env.example .env
```

`.env` content:

```env
PORT=<backend_port>
ADMIN_USER=<username>
ADMIN_PASSWORD_HASH=<bcrypt_hash>
JWT_SECRET=<long_random_string>
NODE_ENV=production
PORTFOLIO_DATA_PATH=<path_to_portfolio_data_directory>
```

Generate the password hash:
```bash
node -e "require('bcrypt').hash('YOUR_PASSWORD', 10).then(console.log)"
```

### 3. Systemd service

Create `/etc/systemd/system/admin-backend.service`, replacing `<user>` and `<install_path>`:

```ini
[Unit]
Description=Admin Panel Backend
After=network.target

[Service]
Type=simple
User=<user>
WorkingDirectory=<install_path>/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
EnvironmentFile=<install_path>/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable admin-backend
sudo systemctl start admin-backend
```

### 4. Sudoers

Create `/etc/sudoers.d/admin-panel`, replacing `<user>`:

```
<user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl start nginx, /usr/bin/systemctl stop nginx, /usr/bin/systemctl reload nginx, /usr/bin/systemctl status nginx, /usr/bin/systemctl is-active nginx, /usr/bin/systemctl restart admin-backend, /usr/bin/ln, /usr/bin/rm, /usr/bin/tee
```

```bash
sudo visudo -f /etc/sudoers.d/admin-panel
```

### 5. Frontend

```bash
cd frontend
docker compose up -d --build
```

The exposed port is defined in `docker-compose.yml` and `httpd.conf` — adjust them as needed.

### 6. Nginx virtual host

Create `/etc/nginx/sites-available/admin-panel`, replacing `<domain>`, `<frontend_port>` and `<backend_port>`:

```nginx
server {
    listen 80;
    server_name <domain>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <domain>;

    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:<backend_port>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:<frontend_port>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo certbot certonly --nginx -d <domain>
sudo ln -s /etc/nginx/sites-available/admin-panel /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

## Automatic deployment (GitHub Actions)

### Required secrets

In **Settings → Secrets and variables → Actions** on GitHub:

| Secret | Value |
|---|---|
| `VPS_HOST` | Server IP or hostname |
| `VPS_SSH_KEY` | SSH private key (contents of `~/.ssh/id_ed25519` or `~/.ssh/id_rsa`) |

The corresponding public key must be present in `~/.ssh/authorized_keys` on the server.

### Behavior

Every push to `master` triggers deployment of both services in parallel:
- **Backend**: `git pull` → `npm install` → `npm run build` → `systemctl restart`
- **Frontend**: `git pull` → `docker compose up -d --build`

> The SSH username and paths in the deployment script must be updated in `.github/workflows/deploy-admin.yml`.