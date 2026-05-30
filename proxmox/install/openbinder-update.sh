#!/usr/bin/env bash
# Runs inside the OpenBinder LXC for updates.
set -euo pipefail

INSTALL_DIR="/opt/open-binder"
VERBOSE="${OPENBINDER_VERBOSE:-no}"

log() { printf '[OpenBinder] %s\n' "$*"; }
die() { printf '[OpenBinder] ERROR: %s\n' "$*" >&2; exit 1; }

run() {
  if [[ "$VERBOSE" == "yes" ]]; then
    "$@"
  else
    "$@" >/dev/null 2>&1
  fi
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Must run as root inside the container."
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
chmod +x ./scripts/deploy.sh
run ./scripts/deploy.sh

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Update finished"
log "OpenBinder: http://${LOCAL_IP:-127.0.0.1}:3000"
