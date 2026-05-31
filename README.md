<p align="center">
  <img src="public/icon.svg" alt="OpenBinder Logo" width="120" height="120" />
</p>

<h1 align="center">OpenBinder</h1>

<p align="center">
  Mobile-first, self-hostable web app to manage your Pokémon TCG collection — with multiple collections, checklists, inventory tracking, and direct Cardmarket links.
</p>

---

## Overview

OpenBinder is an unofficial fan tool for Pokémon TCG collectors who want **multiple binders**, **set progress**, and easy **Cardmarket links** without spreadsheets. Card data comes from [TCGdex](https://tcgdex.dev). The app runs as a **Progressive Web App (PWA)** — install it on your phone or use it in the browser, with a mobile-first layout and bottom navigation.

**Navigation:** Dashboard · Sets · Collections · Search · Settings

> **Languages:** The UI is available in **English** and **German** (switch in Settings). Card and set names follow your UI language where TCGdex provides translations. Each inventory entry can still record **German** or **English** as the physical card language.

### Why collectors use it

| Need | How OpenBinder helps |
| --- | --- |
| Master a classic set | Create a **set collection** — checklist pre-filled with every card; track owned vs missing |
| Chase cards across sets | Use a **custom collection** — mix Charizard, Mewtwo, etc. from different sets |
| Know portfolio value | **Cardmarket EUR** (Trend or Low) per variant, summed across all copies |
| Quick logging at a trade | **Long-press** on the checklist for Quick Add with your default condition |
| Check binders offline | **Offline mode** mirrors binders locally while online; read-only checklist & inventory when disconnected |

### Collector workflow (end to end)

1. **Sync catalog** — worker loads set metadata; you **load cards** per set on demand (Base Set, etc.).
2. **Create binders** — *Base Set Master* (set collection) + *Graded Chase Cards* (custom).
3. **Browse & search** — Sets grid or Search (`Charizard`, `BS 4`) → card preview → add to checklist.
4. **Record copies** — open collection → Checklist → tap card for variant/condition/notes, or long-press for Quick Add.
5. **Review** — Dashboard portfolio, collection Inventory tab, filters (owned / rarity).

### Screenshots

| Dashboard | Sets | Set detail | Card preview |
| --- | --- | --- | --- |
| ![Dashboard — portfolio & recent adds](docs/screenshots/01-dashboard.png) | ![Sets — browse by series](docs/screenshots/02-sets.png) | ![Set detail — catalog + progress](docs/screenshots/03-set-detail.png) | ![Card preview — prices & checklist](docs/screenshots/04-card-preview.png) |

| Search | Collections | Checklist | Card modal |
| --- | --- | --- | --- |
| ![Search — find cards across catalog](docs/screenshots/05-search.png) | ![Collections — all binders](docs/screenshots/06-collections.png) | ![Checklist — owned filter](docs/screenshots/07-collection-checklist.png) | ![Card modal — record a copy](docs/screenshots/08-card-modal.png) |

| Inventory | Custom collection | | |
| --- | --- | --- | --- |
| ![Inventory — copies, qty, value](docs/screenshots/09-collection-inventory.png) | ![Custom collection — mixed chase cards](docs/screenshots/10-custom-collection.png) | | |

To reproduce demo data locally: `npm run prepare:readme-screenshots` (requires app + worker on `http://localhost:3000`). Full screenshot workflow: [`docs/update-readme-screenshots.md`](docs/update-readme-screenshots.md).

---

## Collections — how it works

OpenBinder organizes your cards in **multiple collections** (*Sammlungen*) — think of them as binders or folders. Each collection has two layers:

| Layer | EN | DE | What it means |
| --- | --- | --- | --- |
| **Checklist** | Checklist | Checkliste | Which cards you want to track in this collection |
| **Inventory** | Inventory | Bestand | Physical copies you have actually recorded (variant, condition, quantity, notes, value) |

**Set pages are catalogs**, not ownership trackers. To track progress for a set, create a **set collection** from that set. Search and set browsing help you **add cards to checklists**; **recording copies** always happens inside a collection.

### Collection types

- **Set collection** (*Set-Sammlung*) — created from a downloaded set. The checklist is **pre-filled with every card in the set**. You can create several set collections for the same set (e.g. “Master Set” and “Trade Binder”).
- **Custom collection** (*Eigene Sammlung*) — starts empty. Add cards to the checklist via Search or Sets. Can mix cards from different sets.

### Typical workflow

1. **Create a collection** — from the Collections tab or from a set detail page.
2. **Build the checklist** — automatic for set collections; pick cards individually for custom collections (Search / Sets → *Add to checklist* / *Zur Checkliste hinzufügen*).
3. **Record what you own** — open the collection, switch to the **Checklist** tab, tap or long-press a card to add copies to **Inventory** (*Bestand*).
4. **Review inventory** — the **Inventory** tab lists all recorded copies with quantity, value, search, and edit/delete.

The legacy route `/collection` redirects to `/collections`.

---

## Pages & Features

### Dashboard (`/`)

Home screen with a snapshot across all collections:

- **Inventory overview** — unique card count and total copies across all collections
- **Your collections** — up to six collections by progress (*X of Y in inventory* / *X von Y im Bestand*); link to all collections
- **Recently recorded** (*Zuletzt erfasst*) — latest inventory entries; tap opens that collection’s Inventory tab filtered to the card

### Sets (`/sets`)

All Pokémon sets, grouped by series (e.g. Base, Neo, …) — browse the catalog and create set collections:

- **Search** by set name or official code (e.g. “Base Set”, “BS”)
- **Filters** — *Cards loaded* (*Karten geladen*), *Has collection* (*Mit Sammlung*)
- **Progress** per set — shown once you have a set collection for that set (owned checklist cards / total)
- **Load cards** — card data is synced **on demand per set**, not all at once
- **Live sync indicator** — shows running catalog or set-card sync jobs and queue status
- Set logos and placeholders are cached locally during sync

### Set detail (`/sets/[id]`)

Catalog view for a single set — browse cards and manage set collections:

- **Your collections for this set** — list with progress; **Create collection from set** (*Sammlung aus Set erstellen*)
- Hint: *“To track your progress, create a collection from this set.”*
- **Card grid** (3–4 columns) with number, name, and checklist badge (*On N checklist(s)* / *Auf N Checkliste(n)*)
- **Tap** → card preview modal → **Add to checklist** (see below)
- **Long-press (select mode)** → select multiple cards and add to checklists in bulk (see below)
- **Filters** by **rarity** (Common, Rare, Ultra Rare, … — German labels in the UI)
- If card data is missing: **Load cards** button with progress indicator

### Search (`/search`)

Find cards across the full catalog and add them to checklists:

- **Full-text search** (German) from 2 characters, with 300 ms debounce
- Query patterns:
  - **Name** — e.g. “Glurak” (Charizard)
  - **Number** — e.g. “4”
  - **Set + number** — e.g. “Dschungel 60” or “BS 4”
- Results show set name and checklist badge
- **Tap** → card preview modal → **Add to checklist**
- **Long-press (select mode)** → select multiple cards and add to checklists in bulk (see below)
- With `?collectionId=…` (from a custom collection’s *Go to search* link): subtitle becomes *“Add cards to checklist”*

### Collections list (`/collections`)

All your collections (*Deine Ordner und Set-Checklisten*):

- **Create** (*Erstellen*) — choose **Custom collection** or **Create collection from set** (redirects to Sets)
- Each row: cover image, name, progress (*X of Y in inventory*), percent complete
- Empty checklist: *“Checklist empty”* (*Checkliste leer*)

### Collection detail (`/collections/[id]`)

Inside a single collection — where progress and ownership live:

- **Header** — cover, name, link to set (set collections) or *Custom collection* label
- **Progress bar** — checklist cards with at least one inventory entry / total checklist cards
- **⋮ menu** → **Delete collection** (removes checklist and all inventory entries)
- **Two tabs** (*Collection view* / *Sammlungsansicht*):

#### Checklist tab (*Checkliste*)

- Grid of checklist cards with filters *In inventory* / *Not in inventory* and by rarity
- **Tap** → card modal → record or edit inventory (*Add to inventory* / *Zum Bestand hinzufügen*)
- **Long-press (Quick Add)** → record a copy with defaults (see below)
- Custom collections: links to Search and Sets to add more cards to the checklist

#### Inventory tab (*Bestand*)

- **Summary** — entry count
- **Search** by name, number, or set
- **Card filter** — via URL `?view=entries&cardId=…` (e.g. from the card modal or dashboard)
- **Infinite scroll** — loads more entries while scrolling (20 per page)
- Per entry:
  - Card image (tap → lightbox with zoom)
  - Variant, condition, language, notes
  - **Quantity** via +/- (at 0 → confirm delete)
  - **Delete** with confirmation dialog

**Removing from a custom collection:** in the card modal → *Remove from collection* — removes the card from the checklist and deletes all inventory entries for that card in this collection.

### Settings (`/settings`)

- **Default condition** (*Standard-Zustand*) — used for Quick Add and as preset when recording new copies in the card modal
- **Manual sync**
  - *Sync sets* — refresh set metadata from the catalog
- **Job history** — status, progress, and error details for recent sync jobs
- Note: the **worker** must be running for sync jobs to be processed

---

## Card image — full view & zoom

Available from the card modals and Inventory tab (tap the card image):

- **Full-screen lightbox** on a dark backdrop
- **Pinch-to-zoom** — 1× to 5×
- **Double-tap** (touch) / **double-click** (desktop) — zoom to 2.5× or reset
- **Pan** — drag the image when zoomed in
- **Close** — tap outside, X button, or Escape

---

## Quick Add (long-press)

On a collection’s **Checklist** tab (`/collections/[id]`) you can record copies **without opening the modal**:

1. **Press and hold** (~1.2 s) on a card
2. Progress ring shows the hold timer
3. Short **vibration feedback** (where supported)
4. Card is saved to **inventory** with **defaults**:
   - Variant: already-owned variant if any, otherwise the first available
   - Quantity: 1 · Condition: from Settings (*Standard-Zustand*, default NM) · Language: German
5. Toast confirmation at the bottom of the screen (*recorded* / *erfasst*)

A normal **tap** still opens the card modal for fine-grained input.

---

## Select mode (long-press)

On **Search** (`/search`) and **Set detail** (`/sets/[id]`) you can add multiple cards to checklists **without opening each card preview**:

1. **Press and hold** (~0.45 s) on a card to enter **select mode** — progress ring with check icon
2. Short **vibration feedback** (where supported); the held card is selected
3. **Tap** other cards to toggle selection; selected cards show a highlight
4. **Toolbar** at the bottom shows the count (*N selected* / *N ausgewählt*), **Cancel** (X), and **Actions** (⋮)
5. **Actions → Add to checklist** (*Zur Sammelliste hinzufügen*) — pick one or more binders, confirm **Add** (same picker as single-card add, including locked set binders that already contain a card)
6. Checklist badges update; selection clears on success

A normal **tap** (when select mode is off) still opens the card preview modal. While select mode is active, use tap to toggle cards — another long-press does not restart selection.

---

## Sync — how it works

OpenBinder syncs data in **three stages** via a background worker (pg-boss):

| Stage | What | When | Trigger |
| --- | --- | --- | --- |
| **Catalog (sets)** | Set metadata (name, series, code, logos) | Weekly Sun 03:00 UTC · on first start (empty DB) | Worker bootstrap, manual in Settings |
| **Card data (per set)** | Cards, variants, images → local disk | On demand | “Load cards” on set list or set detail |

**First-start flow:**

1. Worker starts, detects empty database → initial catalog sync (15–30 min)
2. Set list appears; card data per set must be **loaded on demand**
3. Images are stored under `storage/images` during card sync (configurable via `IMAGE_STORAGE_PATH`)

**Important:** App and worker run separately — without the worker, sync jobs stay queued. Docker Compose includes both services.

For faster local testing, use `CATALOG_SET_IDS` and `CATALOG_SET_CARD_LIMIT` (see environment variables).

---

## Cardmarket links

Each card variant has a direct link to its Cardmarket product page (stored during card sync via TCGdex). The link opens in your browser so you can look up current prices, seller listings, and condition details yourself. No EUR values are stored or displayed in the app.

---

## PWA & offline

OpenBinder is a **Progressive Web App** — install it on your phone (Add to Home Screen) or use it in the browser. The mobile layout uses safe-area insets and fixed bottom navigation.

### Install & app shell

- Installable as a **standalone app** (manifest, icons, `apple-touch-icon`)
- **Service worker** precaches the app shell and static assets; checks for updates when the tab regains focus
- Card and cover images under `/api/images/` and `/api/collection-covers/` use **network-first** caching — once loaded, they stay available offline

### Offline mode (binders)

While you use the app **online**, OpenBinder **mirrors your binders to IndexedDB** in the background: collection list, checklist, inventory entries, and portfolio totals per binder. Sync runs when you open the app, return to the tab, reconnect after being offline, or change a binder (add/remove cards, record copies).

When you go **offline**, the app switches to a **read-only offline view**:

| Online | Offline |
| --- | --- |
| All tabs (Dashboard, Sets, Collections, Search, Settings) | **Collections only** — other tabs are disabled |
| Full editing (checklist, inventory, create binders) | **View only** — browse binders, open checklist & inventory tabs, inspect card details |
| Search & catalog browsing | Not available |

A banner at the top shows **“Offline view · as of {date} · read-only”** (with the timestamp of the last full sync). Within Collections, you can switch between the binder list and individual binders without a network connection — navigation stays in-memory so iOS Safari does not show a native offline error page.

**Card images** in offline view only appear if you loaded them before going offline (same network-first image cache as above).

**First-time offline:** open the app online at least once so binders can sync. If you go offline with no cached data, Collections shows *“No cached binders. Open the app online first.”*

### Manage the offline cache

In **Settings → Offline cache** you can see how many binders are cached, when they were last synced, and **clear the cache** (removes all mirrored binder data and cached images).

### What is *not* offline

- Dashboard, Sets, Search, and Settings
- Creating or editing binders, checklists, or inventory entries
- Catalog sync and search

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

## Proxmox VE (LXC)

Install OpenBinder as an unprivileged Debian 13 LXC on [Proxmox VE](https://www.proxmox.com/) (8.x or 9.x). On the **Proxmox host**, as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/whoppercheese/open-binder/main/proxmox/install.sh)"
```

This creates an LXC named `openbinder` (1 CPU, 2 GB RAM, 32 GB disk by default), installs Docker inside the container, clones this repo to `/opt/open-binder`, and runs `./scripts/deploy.sh`. When finished, open the app at port **3000** on the container’s IP address. Postgres credentials are in `/root/openbinder.creds` inside the LXC (`pct enter <CTID>`).

Update an existing install from the host:

```bash
OPENBINDER_MODE=update bash -c "$(curl -fsSL https://raw.githubusercontent.com/whoppercheese/open-binder/main/proxmox/install.sh)"
```

More options (resource overrides, troubleshooting): [`proxmox/README.md`](proxmox/README.md).

## Reset (Dev)

Clear catalog, collections, sync jobs, pg-boss queue, and cached card images:

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
