#!/bin/bash
# Idempotent setup of the admin panel's privileged parts, run as root after each deployment:
#   - dedicated `admin-backend` user and its ACLs (read-only on the code, rw on portfolio images)
#   - root-owned copy of the privileged helper (deploy/admin-panel-helper)
#   - /etc/sudoers.d/admin-panel (validated with visudo before being installed)
#   - systemd unit admin-backend.service
#   - filtering Docker socket proxy (deploy/docker-socket-proxy), DOCKER_HOST in backend/.env
#   - restart of the backend, with a health check
#
# First run, by hand on the server (it then allows the deploy user to run it without a password):
#   sudo /home/debian/admin-panel/deploy/install.sh
# Then the GitHub Actions workflow runs it on every push to master.
#
# Note: since the deploy user may run this script (which lives in the repository) as root, pushing
# to master or holding the deploy SSH key gives root on the server. The backend itself does not:
# `admin-backend` cannot modify the repository.

set -euo pipefail
umask 022
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C

readonly SERVICE_USER=admin-backend
readonly SERVICE_NAME=admin-backend
readonly HELPER_DEST=/usr/local/sbin/admin-panel-helper
readonly SUDOERS_FILE=/etc/sudoers.d/admin-panel
readonly UNIT_FILE=/etc/systemd/system/${SERVICE_NAME}.service
readonly PROXY_PROJECT=admin-panel-socket-proxy
readonly PROXY_DOCKER_HOST=tcp://127.0.0.1:2375

log() { echo "==> $*"; }
die() {
    echo "install.sh: $*" >&2
    exit 1
}

[[ $EUID -eq 0 ]] || die "must be run as root (sudo $0)"

REPO=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
readonly REPO
readonly BACKEND_DIR=$REPO/backend
readonly ENV_FILE=$BACKEND_DIR/.env
readonly INSTALL_SCRIPT=$REPO/deploy/install.sh

# The deploy user owns the repository
DEPLOY_USER=$(stat -c %U "$REPO")
readonly DEPLOY_USER
[[ $DEPLOY_USER != root ]] || die "the repository must belong to the deploy user, not root"
[[ -f $BACKEND_DIR/dist/index.js ]] || die "backend not built: run npm run build in $BACKEND_DIR first"
[[ -f $ENV_FILE ]] || die "missing $ENV_FILE (see backend/.env.template)"

env_value() {
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

# ------------------------------------------------------------------ dependencies
if ! command -v setfacl > /dev/null; then
    log "Installing acl"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq acl > /dev/null
fi
command -v docker > /dev/null || die "docker is not installed"
NODE_BIN=$(command -v node) || die "node is not in root's PATH (install it system-wide, e.g. /usr/bin/node)"
readonly NODE_BIN

# ------------------------------------------------------------------ service user
if ! id "$SERVICE_USER" > /dev/null 2>&1; then
    log "Creating system user $SERVICE_USER"
    adduser --system --group --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER" > /dev/null
fi
if id -nG "$SERVICE_USER" | tr ' ' '\n' | grep -qx docker; then
    log "Removing $SERVICE_USER from the docker group (it goes through the socket proxy)"
    gpasswd -d "$SERVICE_USER" docker > /dev/null
fi

log "Setting ACLs"
# Traverse permission on the ancestors that are not world-searchable (e.g. a 0700 home)
dir=$REPO
while [[ $dir != / ]]; do
    if [[ $(stat -c %A "$dir") != *x ]]; then
        setfacl -m "u:$SERVICE_USER:--x" "$dir"
    fi
    dir=$(dirname "$dir")
done
# Read-only on the backend; default ACLs cover files later created by git pull / npm run build
setfacl -R -m "u:$SERVICE_USER:rX" -m "d:u:$SERVICE_USER:rX" "$BACKEND_DIR"
chown "$DEPLOY_USER:" "$ENV_FILE"
chmod 600 "$ENV_FILE"
setfacl -m "u:$SERVICE_USER:r" "$ENV_FILE"

IMAGES_PATH=$(env_value PORTFOLIO_IMAGES_PATH)
if [[ -n $IMAGES_PATH ]]; then
    [[ $IMAGES_PATH == /* && $IMAGES_PATH != *..* ]] || die "PORTFOLIO_IMAGES_PATH must be an absolute path"
    [[ -d $IMAGES_PATH ]] || die "PORTFOLIO_IMAGES_PATH does not exist: $IMAGES_PATH"
    setfacl -R -m "u:$SERVICE_USER:rwX" -m "d:u:$SERVICE_USER:rwX" "$IMAGES_PATH"
    dir=$(dirname "$IMAGES_PATH")
    while [[ $dir != / ]]; do
        [[ $(stat -c %A "$dir") == *x ]] || setfacl -m "u:$SERVICE_USER:--x" "$dir"
        dir=$(dirname "$dir")
    done
fi

# ------------------------------------------------------------------ privileged helper
log "Installing $HELPER_DEST"
install -o root -g root -m 0755 "$REPO/deploy/admin-panel-helper" "$HELPER_DEST"

# ------------------------------------------------------------------ sudoers
log "Installing $SUDOERS_FILE"
sudoers_tmp=$(mktemp)
trap 'rm -f "$sudoers_tmp"' EXIT
cat > "$sudoers_tmp" << EOF
# Managed by $INSTALL_SCRIPT, do not edit by hand.
# Backend: only the privileged helper (validated sub-commands).
$SERVICE_USER ALL=(root) NOPASSWD: $HELPER_DEST
# Deployment (GitHub Actions): this script and the backend restart.
$DEPLOY_USER ALL=(root) NOPASSWD: $INSTALL_SCRIPT, /usr/bin/systemctl restart $SERVICE_NAME
EOF
visudo -cqf "$sudoers_tmp" || die "generated sudoers file is invalid, keeping the current one"
install -o root -g root -m 0440 "$sudoers_tmp" "$SUDOERS_FILE"
visudo -cq || die "sudoers configuration is invalid after installing $SUDOERS_FILE"

# ------------------------------------------------------------------ systemd unit
unit_tmp=$(mktemp)
trap 'rm -f "$sudoers_tmp" "$unit_tmp"' EXIT
cat > "$unit_tmp" << EOF
# Managed by $INSTALL_SCRIPT, do not edit by hand.
[Unit]
Description=Admin Panel Backend
After=network.target docker.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
ExecStart=$NODE_BIN dist/index.js
Restart=on-failure
EnvironmentFile=$ENV_FILE

[Install]
WantedBy=multi-user.target
EOF
if ! cmp -s "$unit_tmp" "$UNIT_FILE"; then
    log "Installing $UNIT_FILE"
    install -o root -g root -m 0644 "$unit_tmp" "$UNIT_FILE"
    systemctl daemon-reload
fi
systemctl enable --quiet "$SERVICE_NAME"

# ------------------------------------------------------------------ docker socket proxy
log "Starting the Docker socket proxy"
DOCKER_GID=$(getent group docker | cut -d: -f3) || die "no docker group"
DOCKER_GID=$DOCKER_GID docker compose -p "$PROXY_PROJECT" \
    -f "$REPO/deploy/docker-socket-proxy/compose.yaml" up -d --quiet-pull --remove-orphans

current_docker_host=$(env_value DOCKER_HOST)
if [[ -z $current_docker_host ]]; then
    log "Setting DOCKER_HOST=$PROXY_DOCKER_HOST in $ENV_FILE"
    sed -i '/^DOCKER_HOST=/d' "$ENV_FILE"
    echo "DOCKER_HOST=$PROXY_DOCKER_HOST" >> "$ENV_FILE"
elif [[ $current_docker_host != "$PROXY_DOCKER_HOST" ]]; then
    echo "warning: DOCKER_HOST=$current_docker_host in $ENV_FILE, not the socket proxy ($PROXY_DOCKER_HOST)" >&2
fi

# ------------------------------------------------------------------ restart
log "Restarting $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 3
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2 || true
    die "$SERVICE_NAME failed to start"
fi
log "Done"
