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
- Edit a virtual host (server name, proxy ports, root)
- Enable / disable / delete a virtual host
- HTTPS with certbot: installs the `*.dvachette.fr` wildcard certificate when it covers the domain,
  otherwise requests a new certificate; shows certificate expiry per vhost

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
- Certbot with the nginx plugin, and the OVH DNS plugin for the wildcard certificate
  (`sudo apt install certbot python3-certbot-nginx python3-certbot-dns-ovh`)
- A non-root sudoer user (deploys), and the `acl` package (`setfacl`)

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
PORTFOLIO_API_URL=http://127.0.0.1:3003
PORTFOLIO_API_TOKEN=<same_value_as_ADMIN_API_TOKEN_in_portfolio_backend>
PORTFOLIO_IMAGES_PATH=<path_to_portfolio_project_images>
CERTBOT_EMAIL=<email_for_lets_encrypt>   # optional, only used if certbot has no account yet
DOCKER_HOST=tcp://127.0.0.1:2375         # filtering Docker socket proxy, set by deploy/install.sh
PRIVILEGED_HELPER=/usr/local/sbin/admin-panel-helper   # optional, this is the default
```

Generate the password hash:
```bash
node -e "require('bcrypt').hash('YOUR_PASSWORD', 10).then(console.log)"
```

### 3. Privileged setup (automated)

[`deploy/install.sh`](deploy/install.sh) sets up everything that needs root. It is idempotent: the
GitHub Actions workflow runs it after every build, and **it must be run once by hand** (it installs
the sudoers rule that lets the workflow run it):

```bash
cd <install_path>/backend && npm install && npm run build   # .env must exist (step 2)
sudo <install_path>/deploy/install.sh
```

What it does:

- **Dedicated user** `admin-backend`, which runs the backend: no shell, no general sudo, not in the
  `docker` group, read-only ACLs on `backend/` and `.env` (`chmod 600`, owned by the deploy user),
  read-write ACLs on `PORTFOLIO_IMAGES_PATH`. It cannot modify the code nor the scripts below.
- **Privileged helper** [`deploy/admin-panel-helper`](deploy/admin-panel-helper), copied to
  `/usr/local/sbin/admin-panel-helper` (root, 0755): everything the backend does as root (nginx,
  vhost files, certbot, ufw) goes through its fixed sub-commands with validated arguments. Paths
  are built by the script, certbot runs without hooks, nginx directives that open files as root
  (`access_log`, `include`, `ssl_certificate`...) are restricted to nginx's and Let's Encrypt's
  directories, and no ufw rule touching SSH (port 22) can be denied or deleted.
- **Sudoers** `/etc/sudoers.d/admin-panel` (checked with `visudo` before being installed):
  ```
  admin-backend ALL=(root) NOPASSWD: /usr/local/sbin/admin-panel-helper
  <deploy_user> ALL=(root) NOPASSWD: <install_path>/deploy/install.sh, /usr/bin/systemctl restart admin-backend
  ```
  It replaces the previous file, including its `rm`, `mv`, `ln`, `tee`, `chmod`, `certbot` entries
  without arguments (sudo allows those with any argument, which is root access).
- **systemd unit** `admin-backend.service` (`User=admin-backend`).
- **Docker socket proxy** [`deploy/docker-socket-proxy`](deploy/docker-socket-proxy/compose.yaml) on
  `127.0.0.1:2375`, and `DOCKER_HOST=tcp://127.0.0.1:2375` in `.env`. Access to the Docker socket
  is root access (`docker run -v /:/host`): the proxy only forwards the calls the panel uses (list,
  inspect, logs, stats, start/stop/restart, remove) and refuses the rest (container creation, exec,
  images, volumes...) with a 403. Without `DOCKER_HOST`, the backend uses the socket directly
  (local development).
- **Restart** of the backend, failing with its last logs if it does not come up.

> **Trust model**: the deploy user may run `install.sh`, a file of the repository, as root. Pushing
> to `master` or holding `VPS_SSH_KEY` is therefore root on the server; protect the branch and the
> secret accordingly. A compromised backend is not: `admin-backend` cannot write to the repository.
>
> `admin-backend` gets a traverse (`--x`) ACL on the parents of `<install_path>` (e.g. a `0700`
> home): it can read world-readable files there if it knows their name, not `0600` ones such as
> SSH keys. Install under `/opt` to avoid it.

### 4. Wildcard certificate (OVH DNS, once)

Let's Encrypt only issues wildcard certificates through a DNS challenge. Certbot creates the
`_acme-challenge` TXT record through the OVH API, which also makes renewals automatic.

1. Create an API token on https://eu.api.ovh.com/createToken/ restricted to the zone:
   `GET /domain/zone/*`, and `GET`, `PUT`, `POST`, `DELETE` on `/domain/zone/dvachette.fr/*`.
2. Store the credentials, readable by root only:

   ```bash
   sudo mkdir -p /root/.secrets/certbot
   sudo tee /root/.secrets/certbot/ovh.ini > /dev/null <<'INI'
   dns_ovh_endpoint = ovh-eu
   dns_ovh_application_key = <application_key>
   dns_ovh_application_secret = <application_secret>
   dns_ovh_consumer_key = <consumer_key>
   INI
   sudo chmod 600 /root/.secrets/certbot/ovh.ini
   ```

3. Issue the certificate (covers `dvachette.fr` and one level of subdomains, not `a.b.dvachette.fr`):

   ```bash
   sudo certbot certonly --dns-ovh \
     --dns-ovh-credentials /root/.secrets/certbot/ovh.ini \
     --dns-ovh-propagation-seconds 60 \
     --cert-name dvachette.fr -d dvachette.fr -d '*.dvachette.fr' \
     --deploy-hook 'systemctl reload nginx'
   ```

   If a `dvachette.fr` certificate already exists, certbot asks to replace its domain list: accept.
   Renewal runs through certbot's systemd timer (`systemctl list-timers | grep certbot`) and
   reloads nginx thanks to the deploy hook; test it with `sudo certbot renew --dry-run`.

4. Existing vhosts: use the lock button in the panel to point each one to the wildcard certificate.
   Old per-domain certificates can then be removed with `sudo certbot delete --cert-name <name>`.

From the panel, creating a vhost with SSL writes an HTTP vhost, enables it, then runs
`certbot install --nginx` with the wildcard (or `certbot --nginx` for a domain it does not cover),
which adds the 443 block and the HTTP → HTTPS redirect.

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

## Local development

The portfolio pages talk to the portfolio backend admin API. To work on them without it, run the
in-memory mock of that API (`backend/dev/portfolio-mock.ts`, data reset on restart):

```env
# backend/.env (dev values)
PORT=3000
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=<bcrypt_hash>
JWT_SECRET=dev-secret
PORTFOLIO_API_TOKEN=dev-portfolio-token   # shared by the backend and the mock
PORTFOLIO_IMAGES_PATH=<any_local_directory>
```

```bash
cd backend && npm run mock:portfolio   # terminal 1 — mock on http://127.0.0.1:3003
cd backend && npm run dev              # terminal 2 — backend on :3000
cd frontend && npm run dev             # terminal 3 — frontend on http://localhost:3005
```

Mock options: `PORTFOLIO_MOCK_DATA_DIR=../../portfolio/portfolio-backend/data` seeds it with real
`projects.json` / `skills.json`, `PORTFOLIO_MOCK_LATENCY_MS=500` adds a delay to every response,
`PORTFOLIO_MOCK_PORT` changes its port (then set `PORTFOLIO_API_URL` accordingly).

## Automatic deployment (GitHub Actions)

### Required secrets

In **Settings → Secrets and variables → Actions** on GitHub:

| Secret | Value |
|---|---|
| `VPS_HOST` | Server IP or hostname |
| `VPS_SSH_KEY` | SSH private key (contents of `~/.ssh/id_ed25519` or `~/.ssh/id_rsa`) |

The corresponding public key must be present in `~/.ssh/authorized_keys` on the server.

### Behavior

Every push to `master` triggers the deployment (never two at the same time):
- **Backend**: `git pull --ff-only` → `npm install` → `npm run build` → `sudo -n deploy/install.sh`
  (privileged setup and restart, see Installation step 3)
- **Frontend**, once the backend job is done (same checkout): `docker compose up -d --build`

The first deployment fails with an explicit error until `sudo deploy/install.sh` has been run once
on the server.

> The SSH username and paths in the deployment script must be updated in `.github/workflows/deploy-admin.yml`.