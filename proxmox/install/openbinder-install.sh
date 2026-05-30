#!/usr/bin/env bash
# Runs inside the OpenBinder LXC on first install.
set -euo pipefail

INSTALL_DIR="/opt/open-binder"
REPO_URL="${OPENBINDER_REPO_URL:-https://github.com/whoppercheese/open-binder.git}"
REPO_BRANCH="${OPENBINDER_REPO_BRANCH:-main}"
VERBOSE="${OPENBINDER_VERBOSE:-no}"

log() { printf '[OpenBinder] %s\n' "$*"; }
die() { printf '[OpenBinder] ERROR: %s\n' "$*" >&2; exit 1; }

run() {
  if [[ "$VERBOSE" == "yes" ]]; then
    "$@"
  else
    "$@" >/dev/null
  fi
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Must run as root inside the container."
}

get_local_ip() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$ip" ]] || ip="127.0.0.1"
  printf '%s' "$ip"
}

raw_repo_base() {
  local repo_path="${REPO_URL#https://github.com/}"
  repo_path="${repo_path#http://github.com/}"
  repo_path="${repo_path%.git}"
  printf 'https://raw.githubusercontent.com/%s/%s' "$repo_path" "$REPO_BRANCH"
}

install_update_command() {
  local update_url
  update_url="$(raw_repo_base)/proxmox/install/openbinder-update.sh"
  cat >/usr/bin/update <<EOF
#!/usr/bin/env bash
exec bash -c "\$(curl -fsSL '${update_url}')"
EOF
  chmod +x /usr/bin/update
}

require_root

export DEBIAN_FRONTEND=noninteractive

log "Updating base system"
run apt-get update
run apt-get upgrade -y

log "Installing dependencies"
run apt-get install -y git curl ca-certificates openssl

log "Installing Docker (Engine + Compose plugin)"
docker_config="/etc/docker/daemon.json"
mkdir -p "$(dirname "$docker_config")"
printf '{\n  "log-driver": "journald"\n}\n' >"$docker_config"
run sh -c "$(curl -fsSL https://get.docker.com)"
log "Installed Docker"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Existing clone found — skipping git clone"
else
  log "Cloning OpenBinder"
  run git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
  log "Cloned OpenBinder"
fi

POSTGRES_USER="binder"
POSTGRES_DB="binder"
POSTGRES_PASSWORD="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c16)"
LOCAL_IP="$(get_local_ip)"

if [[ -f "${INSTALL_DIR}/.env" ]]; then
  log ".env exists — leaving it unchanged"
else
  log "Creating environment file"
  cat >"${INSTALL_DIR}/.env" <<EOF
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
BOOTSTRAP_CATALOG_SYNC=true
EOF
  {
    echo "OpenBinder Credentials"
    echo "Postgres User: ${POSTGRES_USER}"
    echo "Postgres Password: ${POSTGRES_PASSWORD}"
    echo "Postgres Database: ${POSTGRES_DB}"
    echo "App URL: http://${LOCAL_IP}:3000"
  } >~/openbinder.creds
  chmod 600 ~/openbinder.creds
  log "Created environment file"
fi

log "Deploying OpenBinder (this can take several minutes)"
cd "$INSTALL_DIR"
chmod +x ./scripts/deploy.sh
if ! ./scripts/deploy.sh; then
  die "Deploy failed. Run OPENBINDER_VERBOSE=yes update or cd ${INSTALL_DIR} && ./scripts/deploy.sh for details."
fi
log "Deploy finished"

touch "${INSTALL_DIR}/.openbinder-proxmox"
grep -qxF '.openbinder-proxmox' "${INSTALL_DIR}/.gitignore" 2>/dev/null ||
  printf '\n.openbinder-proxmox\n' >>"${INSTALL_DIR}/.gitignore"
install_update_command
log "OpenBinder is available at http://${LOCAL_IP}:3000"
