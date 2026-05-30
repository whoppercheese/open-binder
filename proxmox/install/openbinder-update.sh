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

prepare_repo_for_update() {
  # Legacy Proxmox installs left a marker in the clone; it blocked deploy before .gitignore had the entry.
  rm -f "${INSTALL_DIR}/.openbinder-proxmox"

  # Older update scripts appended to tracked .gitignore — restore so pull can run.
  if [[ -n "$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=no -- .gitignore 2>/dev/null)" ]]; then
    git -C "$INSTALL_DIR" checkout -- .gitignore
  fi
}

resolve_repo_from_clone() {
  [[ -d "${INSTALL_DIR}/.git" ]] ||
    die "No OpenBinder installation found in ${INSTALL_DIR}"

  if [[ -z "$REPO_URL" ]]; then
    REPO_URL="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
  fi
  if [[ -z "$REPO_BRANCH" ]]; then
    REPO_BRANCH="$(git -C "$INSTALL_DIR" symbolic-ref -q --short HEAD 2>/dev/null || true)"
  fi

  [[ -n "$REPO_URL" && -n "$REPO_BRANCH" ]] ||
    die "Could not determine git remote or branch in ${INSTALL_DIR}."
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Must run as root inside the container."
}

raw_repo_base() {
  local repo_path="${REPO_URL#https://github.com/}"
  repo_path="${repo_path#http://github.com/}"
  repo_path="${repo_path#git@github.com:}"
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

[[ -f "${INSTALL_DIR}/docker-compose.yml" ]] ||
  die "No OpenBinder installation found in ${INSTALL_DIR}"

export DEBIAN_FRONTEND=noninteractive

log "Updating base system"
run apt-get update
run apt-get upgrade -y

log "Updating Docker Engine"
run apt-get install -y --only-upgrade \
  docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin

resolve_repo_from_clone
log "Updating OpenBinder (branch: ${REPO_BRANCH})"
cd "$INSTALL_DIR"
prepare_repo_for_update
chmod +x ./scripts/deploy.sh
if ! ./scripts/deploy.sh; then
  die "Deploy failed. Run OPENBINDER_VERBOSE=yes update or cd ${INSTALL_DIR} && ./scripts/deploy.sh for details."
fi

install_update_command

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Update finished"
log "OpenBinder: http://${LOCAL_IP:-127.0.0.1}:3000"
