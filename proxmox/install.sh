#!/usr/bin/env bash
# Proxmox host entry point — create LXC and install OpenBinder from this GitHub repo.
set -euo pipefail

GITHUB_REPO="${OPENBINDER_GITHUB_REPO:-whoppercheese/open-binder}"
GITHUB_BRANCH="${OPENBINDER_GITHUB_BRANCH:-main}"
RAW_BASE="https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}"
CONTAINER_INSTALL_URL="${RAW_BASE}/proxmox/install/openbinder-install.sh"
CONTAINER_UPDATE_URL="${RAW_BASE}/proxmox/install/openbinder-update.sh"

HOSTNAME="${OPENBINDER_HOSTNAME:-openbinder}"
CPU="${OPENBINDER_CPU:-1}"
RAM="${OPENBINDER_RAM:-2048}"
DISK="${OPENBINDER_DISK:-32}"
BRIDGE="${OPENBINDER_BRIDGE:-vmbr0}"
CTID="${OPENBINDER_CTID:-}"
MODE="${OPENBINDER_MODE:-install}"
VERBOSE="${OPENBINDER_VERBOSE:-no}"
PASSWORD="${OPENBINDER_PASSWORD:-}"

log() { printf '[OpenBinder] %s\n' "$*"; }
die() { printf '[OpenBinder] ERROR: %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Run as root on the Proxmox host."
  command -v pct >/dev/null 2>&1 || die "pct not found — is this a Proxmox VE host?"
}

pick_storage() {
  local content="$1"
  if [[ -n "${OPENBINDER_STORAGE:-}" ]]; then
    printf '%s' "$OPENBINDER_STORAGE"
    return
  fi
  pvesm status -content "$content" 2>/dev/null |
    awk 'NR>1 && $3=="active" { print $1; exit }'
}

ensure_debian_template() {
  local template_storage template_name template_path
  template_storage="$(pick_storage vztmpl)"
  [[ -n "$template_storage" ]] || die "No active storage for container templates (vztmpl)."

  template_name="$(pveam available --section system 2>/dev/null |
    awk '/debian-13-standard/ && /amd64/ { print $2; exit }')"
  [[ -n "$template_name" ]] || die "Debian 13 template not found. Run: pveam update"

  template_path="${template_storage}:vztmpl/${template_name}"
  if ! pveam list "$template_storage" 2>/dev/null | grep -qF "$template_name"; then
    log "Downloading template ${template_name}…"
    pveam download "$template_storage" "$template_name"
  fi
  printf '%s' "$template_path"
}

next_ctid() {
  if [[ -n "$CTID" ]]; then
    printf '%s' "$CTID"
    return
  fi
  pvesh get /cluster/nextid 2>/dev/null || echo 100
}

find_openbinder_ctid() {
  local line id name
  while read -r line; do
    id="$(awk '{print $1}' <<<"$line")"
    name="$(awk '{print $4}' <<<"$line")"
    [[ "$name" == "$HOSTNAME" ]] && printf '%s' "$id" && return 0
  done < <(pct list 2>/dev/null || true)
  return 1
}

wait_for_network() {
  local id="$1"
  local attempt
  for attempt in $(seq 1 60); do
    if pct exec "$id" -- ping -c1 -W1 1.1.1.1 >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "Container ${id} has no outbound network after waiting."
}

run_in_container() {
  local id="$1"
  local script_url="$2"
  local env_args=(
    "OPENBINDER_VERBOSE=${VERBOSE}"
    "OPENBINDER_REPO_URL=https://github.com/${GITHUB_REPO}.git"
    "OPENBINDER_REPO_BRANCH=${GITHUB_BRANCH}"
  )
  log "Running container script…"
  pct exec "$id" -- env "${env_args[@]}" bash -c "$(curl -fsSL "$script_url")"
}

container_ip() {
  local id="$1"
  pct exec "$id" -- hostname -I 2>/dev/null | awk '{print $1}'
}

create_container() {
  local id storage rootfs template_path pw_args=()
  id="$(next_ctid)"
  storage="$(pick_storage rootdir)"
  [[ -n "$storage" ]] || die "No active storage for containers (rootdir)."

  template_path="$(ensure_debian_template)"
  rootfs="${storage}:${DISK}"

  if [[ -n "$PASSWORD" ]]; then
    pw_args=(--password "$PASSWORD")
  fi

  log "Creating LXC ${id} (${HOSTNAME}): ${CPU} CPU, ${RAM} MiB RAM, ${DISK} GB disk"
  pct create "$id" "$template_path" \
    --hostname "$HOSTNAME" \
    --cores "$CPU" \
    --memory "$RAM" \
    --rootfs "$rootfs" \
    --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
    --unprivileged 1 \
    --features nesting=1,keyctl=1 \
    --tags openbinder \
    "${pw_args[@]}"

  log "Starting container ${id}…"
  pct start "$id"
  wait_for_network "$id"
  run_in_container "$id" "$CONTAINER_INSTALL_URL"

  local ip
  ip="$(container_ip "$id")"
  log "Done. OpenBinder: http://${ip:-<container-ip>}:3000"
  log "Credentials (if created): pct enter ${id} — cat ~/openbinder.creds"
  log "Update later: OPENBINDER_MODE=update OPENBINDER_CTID=${id} bash -c \"\$(curl -fsSL ${RAW_BASE}/proxmox/install.sh)\""
}

update_container() {
  local id
  if [[ -n "$CTID" ]]; then
    id="$CTID"
  elif id="$(find_openbinder_ctid)"; then
    :
  else
    die "No container found. Set OPENBINDER_CTID or create one with OPENBINDER_MODE=install."
  fi

  [[ -f "/etc/pve/lxc/${id}.conf" ]] || die "Container ${id} does not exist."
  log "Updating container ${id}…"
  run_in_container "$id" "$CONTAINER_UPDATE_URL"
  local ip
  ip="$(container_ip "$id")"
  log "Done. OpenBinder: http://${ip:-<container-ip>}:3000"
}

main() {
  require_root

  case "${MODE,,}" in
    install | create)
      create_container
      ;;
    update)
      update_container
      ;;
    *)
      die "Unknown OPENBINDER_MODE=${MODE} (use install or update)"
      ;;
  esac
}

main "$@"
