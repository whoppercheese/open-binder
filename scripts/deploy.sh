#!/usr/bin/env bash
# Initial setup and updates: stop app, pull main, prepare env, rebuild & start via Docker Compose.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

GITHUB_REMOTE="${GITHUB_REMOTE:-origin}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/whoppercheese/open-binder.git}"

log() { printf '[OpenBinder] %s\n' "$*"; }
die() { printf '[OpenBinder] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."
}

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

start_compose() {
  log "Building images and starting services (migrate runs automatically)…"
  docker compose up -d --build --pull always
  log "Deploy finished."
  log "App: http://localhost:3000"
  log "First catalog sync can take 15–30 minutes (see README)."
}

main() {
  log "Repository: ${REPO_ROOT}"
  ensure_git_repo
  stop_compose
  pull_latest
  ensure_env_file
  start_compose
}

main "$@"
