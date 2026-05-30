#!/usr/bin/env bash
# Runs inside the OpenBinder LXC for updates.
set -euo pipefail

INSTALL_DIR="/opt/open-binder"
REPO_URL="${OPENBINDER_REPO_URL:-}"
REPO_BRANCH="${OPENBINDER_REPO_BRANCH:-}"
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

ensure_proxmox_marker_ignored() {
  [[ -f "${INSTALL_DIR}/.openbinder-proxmox" ]] || return 0
  grep -qxF '.openbinder-proxmox' "${INSTALL_DIR}/.gitignore" 2>/dev/null &&
    return 0
  printf '\n.openbinder-proxmox\n' >>"${INSTALL_DIR}/.gitignore"
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Must run as root inside the container."
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

[[ -d "${INSTALL_DIR}/.git" && -f "${INSTALL_DIR}/docker-compose.yml" ]] ||
  die "No OpenBinder installation found in ${INSTALL_DIR}"

export DEBIAN_FRONTEND=noninteractive

log "Updating base system"
run apt-get update
run apt-get upgrade -y

log "Updating Docker Engine"
run apt-get install -y --only-upgrade \
  docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin

log "Updating OpenBinder"
cd "$INSTALL_DIR"
ensure_proxmox_marker_ignored
chmod +x ./scripts/deploy.sh
if ! ./scripts/deploy.sh; then
  die "Deploy failed. Run OPENBINDER_VERBOSE=yes update or cd ${INSTALL_DIR} && ./scripts/deploy.sh for details."
fi

if [[ -z "$REPO_URL" && -d "${INSTALL_DIR}/.git" ]]; then
  REPO_URL="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
  REPO_BRANCH="$(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
REPO_URL="${REPO_URL:-https://github.com/whoppercheese/open-binder.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
install_update_command

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Update finished"
log "OpenBinder: http://${LOCAL_IP:-127.0.0.1}:3000"
