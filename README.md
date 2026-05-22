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
