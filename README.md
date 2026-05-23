# OpenBinder — Pokémon TCG Collection Manager

Mobile-first, self-hostable web app to manage your Pokémon TCG collection with German search, set browsing, and Cardmarket EUR portfolio values.

## Features

- Full card catalog synced from [TCGdex](https://tcgdex.dev) (DE)
- Search by name, card number, or set + number (e.g. `Dschungel 60`)
- Browse sets with owned/missing checklist view
- Track variant, condition, language, notes, and purchase price
- Cardmarket EUR prices via TCGdex + product catalog import
- Background jobs (pg-boss): weekly catalog sync, daily price sync
- Docker Compose for self-hosting

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed. Docker Compose reads `.env` automatically; for local `npm run dev` / `npm run worker`, variables are loaded from `.env` via `loadEnvFile()` (existing shell env vars are not overridden).

| Variable | Required | Default | Used by | Description |
| --- | --- | --- | --- | --- |
| `POSTGRES_USER` | No | `binder` | Docker Compose | PostgreSQL username. Used to build `DATABASE_URL` in Compose services. |
| `POSTGRES_PASSWORD` | No | `binder` | Docker Compose | PostgreSQL password. |
| `POSTGRES_DB` | No | `binder` | Docker Compose | PostgreSQL database name. |
| `DATABASE_URL` | Yes* | — | App, worker, migrations | PostgreSQL connection string, e.g. `postgres://binder:binder@localhost:5432/binder`. In Docker Compose this is generated from the `POSTGRES_*` variables; set it explicitly for local development outside Compose. |
| `IMAGE_STORAGE_PATH` | No | `storage/images` | App, worker | Directory for cached card and set images. In Docker Compose defaults to `/app/storage/images` (mounted volume). |
| `BOOTSTRAP_CATALOG_SYNC` | No | `true` (Compose worker) | Worker | When `true`, the worker enqueues an initial catalog sync on startup if the database has no sets. Set to `false` in production if you do not want automatic bootstrap. In non-production (`NODE_ENV` ≠ `production`), bootstrap always runs regardless of this flag. |
| `CATALOG_SET_IDS` | No | — (all sets) | Worker | Comma-separated TCGdex set IDs to limit which sets are synced during catalog sync, e.g. `base1,gym1`. Useful for faster local debugging. Unknown IDs are skipped with a warning. |
| `CATALOG_SET_CARD_LIMIT` | No | — (no limit) | Worker | Maximum number of cards to sync per set (first N cards in set order). Useful for faster local debugging. Invalid values are ignored. |
| `NODE_ENV` | No | `production` (Compose) | App, worker | Standard Node environment. Affects dev tooling and worker bootstrap behavior (see `BOOTSTRAP_CATALOG_SYNC`). |
| `SW_CACHE_VERSION` | No | Git short SHA | `npm run dev` / build | Overrides the service worker cache version in `scripts/generate-sw.mjs`. Set to `dev` during local development (`npm run dev` does this automatically). |

\* Required for the app to connect to PostgreSQL; in Docker Compose it is derived from `POSTGRES_*` if not set manually.

**Worker-only in Compose:** `BOOTSTRAP_CATALOG_SYNC`, `CATALOG_SET_IDS`, and `CATALOG_SET_CARD_LIMIT` are passed to the worker service. Restart the worker after changing catalog-related variables.

## Quick Start

From a fresh clone (or to update an existing install):

```bash
./scripts/deploy.sh
```

The script stops any running stack, pulls `main` from GitHub, creates `.env` from `.env.example` when missing, rebuilds images, runs database migrations, and starts the app with Docker Compose.

Manual alternative:

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:3000

On first start, the worker enqueues an initial catalog sync if the database is empty. This can take 15–30 minutes depending on network speed. Card images are downloaded during catalog sync and stored on disk under `storage/images` (configurable via `IMAGE_STORAGE_PATH`).

If you already synced before adding local image caching, run **Katalog jetzt synchronisieren** in Settings to download missing images.

## Reset (Dev)

Clear catalog, collection, sync jobs, pg-boss queue, and cached card images:

```bash
npm run reset -- --force
```

Stop the worker first if it is running, then restart it after reset to trigger a fresh catalog sync.

## Local Development

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
# in another terminal
npm run worker
```

## Stack

- Next.js 16 (App Router)
- PostgreSQL 16 + Drizzle ORM
- pg-boss for background jobs
- Tailwind CSS

## Disclaimer

Unofficial fan tool. Pokémon is © Nintendo / Creatures Inc. / GAME FREAK inc.
