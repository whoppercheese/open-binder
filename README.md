<p align="center">
  <img src="public/icon.svg" alt="OpenBinder Logo" width="120" height="120" />
</p>

<h1 align="center">OpenBinder</h1>

<p align="center">
  Mobile-first, self-hostable web app to manage your Pokémon TCG collection — with set checklists and Cardmarket EUR portfolio values.
</p>

---

## Overview

OpenBinder is an unofficial fan tool for collectors. Card data comes from [TCGdex](https://tcgdex.dev); prices from Cardmarket (via TCGdex). The app runs as a **Progressive Web App (PWA)** in the browser or as an installable home-screen app — optimized for mobile with a fixed bottom navigation bar.

> **Language focus:** The UI and catalog are **German-first** today: card names, set names, search, and labels are in German (`de`). The catalog is synced from TCGdex with `lang=de`. Collection entries can still track English cards via the language field. Broader locale support may come later; for now, expect German content throughout the app.

**Navigation:** Dashboard · Sets · Search (*Suche*) · Collection (*Sammlung*) · Settings (*Einstellungen*)

---

## Pages & Features

### Dashboard (`/`)

Home screen with a snapshot of your collection:

- **Portfolio value** — estimated total in EUR (Cardmarket, based on your Trend/Low price setting)
- **Cards & entries** — physical card count vs. collection entries (different variants/conditions count separately)
- **Set progress** — top six sets by owned cards with progress bars; link to all sets
- **Recently added** — preview of the latest collection entries with card images
- **Sync status** — last catalog and price sync with a link to settings

### Sets (`/sets`)

All Pokémon sets, grouped by series (e.g. Base, Neo, …):

- **Search** by set name or official code (e.g. “Base Set”, “BS”)
- **Progress** per set (owned/total, percent) — once card data has been loaded
- **Load cards** — card data is synced **on demand per set**, not all at once
- **Live sync indicator** — shows running catalog or set-card sync jobs and queue status
- Set logos and placeholders are cached locally during sync

### Set detail (`/sets/[id]`)

Checklist view for a single set:

- **Progress bar** — how many cards you own
- **Filters**
  - *Owned* / *Missing*
  - by **rarity** (Common, Rare, Ultra Rare, … — German labels in the UI)
- **Card grid** (3–4 columns) with number, name, and Cardmarket price
- **Ownership badge** — green checkmark on owned cards; `×N` badge for multiple copies
- **Tap** → card detail modal (see below)
- **Long-press (Quick Add)** → add a card to your collection instantly (see below)
- If card data is missing: **Load cards** button with progress indicator

### Search (`/search`)

Find cards across the full catalog:

- **Full-text search** (German) from 2 characters, with 300 ms debounce
- Query patterns:
  - **Name** — e.g. “Glurak” (Charizard)
  - **Number** — e.g. “4”
  - **Set + number** — e.g. “Dschungel 60” or “BS 4”
- Results show set name, Cardmarket price, and ownership status
- **Tap** → card detail modal

### Collection (`/collection`)

All saved cards, grouped by set:

- **Summary** — entry count and total value
- **Search** by name, number, or set
- **Card filter** — via URL `?cardId=…` (e.g. from the card modal: “View in collection”)
- **Infinite scroll** — loads more entries while scrolling (20 per page)
- Per entry:
  - Card image (tap → lightbox with zoom)
  - Variant, condition, language, notes
  - Cardmarket value (quantity × price)
  - **Quantity** via +/- (at 0 → confirm delete)
  - **Delete** with confirmation dialog

### Settings (`/settings`)

- **Cardmarket price** — *Trend* or *Low* for portfolio calculation and display
- **Manual sync**
  - *Sync sets* — refresh set metadata from the catalog
  - *Sync prices now* — fetch Cardmarket prices immediately
- **Job history** — status, progress, and error details for recent sync jobs
- Note: the **worker** must be running for sync jobs to be processed

---

## Card detail modal

Opened from search and set detail (tap a card):

- Set link (official code), card number, and German card name
- **Card image** — tap for full-screen lightbox
- **Add to collection** with:
  - **Variant** — Normal, Holo, Reverse Holo, 1st Edition (per card); Cardmarket price per variant
  - **Quantity** (1–999)
  - **Condition** — Mint, NM, LP, MP, HP
  - **Language** — German, English
  - **Notes** (free text)
  - **Purchase price** (EUR, optional)
- **Cardmarket link** — direct product link (foil/non-foil mapped correctly)
- **View in collection** — if you already own the card, link to the filtered collection view

---

## Card image — full view & zoom

Available from the modal and collection (tap the card image):

- **Full-screen lightbox** on a dark backdrop
- **Pinch-to-zoom** — 1× to 5×
- **Double-tap** (touch) / **double-click** (desktop) — zoom to 2.5× or reset
- **Pan** — drag the image when zoomed in
- **Close** — tap outside, X button, or Escape

---

## Quick Add (long-press)

On the set checklist (`/sets/[id]`) you can add cards **without opening the modal**:

1. **Press and hold** (~1.2 s) on a card
2. Progress ring shows the hold timer
3. Short **vibration feedback** (where supported)
4. Card is saved with **defaults**:
   - Variant: already-owned variant if any, otherwise the first available
   - Quantity: 1 · Condition: NM · Language: German
5. Toast confirmation at the bottom of the screen

A normal **tap** still opens the detail modal for fine-grained input.

---

## Sync — how it works

OpenBinder syncs data in **three stages** via a background worker (pg-boss):

| Stage | What | When | Trigger |
| --- | --- | --- | --- |
| **Catalog (sets)** | Set metadata (name, series, code, logos) | Weekly Sun 03:00 UTC · on first start (empty DB) | Worker bootstrap, manual in Settings |
| **Card data (per set)** | Cards, variants, images → local disk | On demand | “Load cards” on set list or set detail |
| **Prices** | Cardmarket EUR (Trend + Low) | Daily 04:00 UTC | Automatic, manual in Settings |

**First-start flow:**

1. Worker starts, detects empty database → initial catalog sync (15–30 min)
2. Set list appears; card data per set must be **loaded on demand**
3. Images are stored under `storage/images` during card sync (configurable via `IMAGE_STORAGE_PATH`)
4. Prices update daily or on manual trigger

**Important:** App and worker run separately — without the worker, sync jobs stay queued. Docker Compose includes both services.

For faster local testing, use `CATALOG_SET_IDS` and `CATALOG_SET_CARD_LIMIT` (see environment variables).

---

## Portfolio & prices

- Values based on **Cardmarket EUR** via TCGdex
- Configurable: **Trend price** (default) or **Low price**
- Separate price per **variant** (Normal vs. Holo vs. Reverse Holo vs. 1st Edition)
- Portfolio = Σ (price × quantity) across all collection entries
- Cards without a price are counted but excluded from the total value

---

## PWA & offline

- Installable as a **standalone app** (manifest, icons, `apple-touch-icon`)
- **Service worker** caches the app shell and static assets; checks for updates when the tab regains focus
- Mobile layout with safe-area support and fixed bottom navigation

---

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

On first start, the worker enqueues an initial catalog sync if the database is empty. This can take 15–30 minutes depending on network speed. Card images are downloaded during card sync and stored on disk under `storage/images` (configurable via `IMAGE_STORAGE_PATH`).

If you already synced before adding local image caching, run **Sync sets** in Settings to download missing images.

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
