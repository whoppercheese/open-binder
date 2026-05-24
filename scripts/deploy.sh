#!/usr/bin/env bash
# Initial setup and updates: pull main, prepare env, rebuild & start via Docker Compose.
# Pass targets to rebuild only specific services (faster for app-only changes).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

GITHUB_REMOTE="${GITHUB_REMOTE:-origin}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/whoppercheese/open-binder.git}"

VALID_TARGETS=(full app worker migrate postgres)
IMAGE_TARGETS=(app worker migrate)

log() { printf '[OpenBinder] %s\n' "$*"; }
die() { printf '[OpenBinder] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [TARGET...]

Targets:
  full (default)  Stop stack, pull, rebuild and start everything.
  app             Pull, rebuild app image, restart app only.
  worker          Pull, rebuild image, restart worker only.
  migrate         Pull, rebuild image, run database migrations.
  postgres        Pull postgres image and recreate postgres (data volume kept).

Examples:
  $(basename "$0")              # full deploy
  $(basename "$0") app          # fast app-only update
  $(basename "$0") app worker   # rebuild image, restart app and worker
  $(basename "$0") migrate app  # migrate, then restart app
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."
}

is_valid_target() {
  local target="$1"
  local valid
  for valid in "${VALID_TARGETS[@]}"; do
    [[ "$target" == "$valid" ]] && return 0
  done
  return 1
}

parse_targets() {
  TARGETS=()
  if [[ $# -eq 0 ]]; then
    TARGETS=(full)
    return
  fi

  for arg in "$@"; do
    case "$arg" in
      -h | --help)
        usage
        exit 0
        ;;
      full | all)
        TARGETS=(full)
        return
        ;;
    esac

    if ! is_valid_target "$arg"; then
      die "Unknown target '${arg}'. Valid targets: ${VALID_TARGETS[*]}"
    fi

    if [[ "$arg" == "full" ]]; then
      TARGETS=(full)
      return
    fi

    local existing
    for existing in "${TARGETS[@]:-}"; do
      [[ "$existing" == "$arg" ]] && continue 2
    done
    TARGETS+=("$arg")
  done
}

target_selected() {
  local wanted="$1"
  local target
  for target in "${TARGETS[@]}"; do
    [[ "$target" == "$wanted" ]] && return 0
  done
  return 1
}

needs_image_build() {
  local target
  for target in "${IMAGE_TARGETS[@]}"; do
    target_selected "$target" && return 0
  done
  return 1
}

parse_targets "$@"

require_cmd docker
require_cmd git
docker compose version >/dev/null 2>&1 || die "'docker compose' (Compose v2 plugin) is required."

stop_compose() {
  if docker compose ps -q 2>/dev/null | grep -q .; then
    log "Stopping running services…"
    docker compose down
  else
    log "No running Compose services."
  fi
}

ensure_git_repo() {
  [[ -d .git ]] || die "Not a git repository. Clone first: git clone ${REPO_URL} open-binder && cd open-binder"
}

ensure_env_file() {
  if [[ -f .env ]]; then
    log ".env exists — leaving it unchanged."
    return
  fi

  if [[ -f .env.example ]]; then
    log "Creating .env from .env.example…"
    cp .env.example .env
  else
    log "Creating .env with default values…"
    cat >.env <<'EOF'
POSTGRES_USER=binder
POSTGRES_PASSWORD=binder
POSTGRES_DB=binder
BOOTSTRAP_CATALOG_SYNC=true
EOF
  fi
}

pull_latest() {
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    die "Uncommitted changes detected. Commit, stash, or discard them before updating."
  fi

  if ! git remote get-url "$GITHUB_REMOTE" >/dev/null 2>&1; then
    die "Git remote '${GITHUB_REMOTE}' is not configured."
  fi

  log "Fetching ${GITHUB_BRANCH} from ${GITHUB_REMOTE}…"
  GIT_TERMINAL_PROMPT=0 git fetch "$GITHUB_REMOTE" "$GITHUB_BRANCH"

  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$current_branch" != "$GITHUB_BRANCH" ]]; then
    log "Checking out ${GITHUB_BRANCH}…"
    git checkout "$GITHUB_BRANCH"
  fi

  log "Pulling latest changes (fast-forward only)…"
  git merge --ff-only "${GITHUB_REMOTE}/${GITHUB_BRANCH}"
}

ensure_postgres_running() {
  if docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    return
  fi

  die "Postgres is not running. Run a full deploy first: ./scripts/deploy.sh full"
}

build_app_image() {
  log "Building application image…"
  docker compose build app
}

run_migrate() {
  log "Running database migrations…"
  docker compose run --rm migrate
}

start_full_compose() {
  log "Building images and starting services (migrate runs automatically)…"
  docker compose up -d --build --pull always
}

start_partial_compose() {
  local up_targets=()

  if target_selected postgres; then
    log "Recreating postgres…"
    docker compose up -d --pull always postgres
  fi

  if needs_image_build; then
    build_app_image
  fi

  if target_selected migrate; then
    run_migrate
  fi

  if target_selected app; then
    up_targets+=(app)
  fi

  if target_selected worker; then
    up_targets+=(worker)
  fi

  if ((${#up_targets[@]} > 0)); then
    log "Restarting: ${up_targets[*]}…"
    docker compose up -d --no-deps "${up_targets[@]}"
  fi
}

main() {
  log "Repository: ${REPO_ROOT}"
  ensure_git_repo
  ensure_env_file

  if target_selected full; then
    stop_compose
    pull_latest
    start_full_compose
  else
    pull_latest
    ensure_postgres_running
    start_partial_compose
  fi

  log "Deploy finished."
  log "App: http://localhost:3000"
  if target_selected full || target_selected worker; then
    log "First catalog sync can take 15–30 minutes (see README)."
  fi
}

main
