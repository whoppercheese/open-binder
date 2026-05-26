#!/usr/bin/env node
/**
 * Prepares catalog, set cards, and demo collections for README screenshots.
 * Writes docs/screenshots/manifest.json for browser automation.
 *
 * Run: node scripts/prepare-readme-screenshots.mjs
 * Requires: app (Next.js) + worker on APP_URL (default http://localhost:3000)
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const POLL_MS = 3000;
const TIMEOUT_MS = Number(process.env.PREPARE_TIMEOUT_MS ?? 900_000);

/** Sets shown on /sets (browse by series). */
export const README_DISPLAY_SET_IDS = [
  "me02.5",
  "gym2",
  "gym1",
  "base3",
  "base2",
  "base1",
];

/** Sets required before seeding collections/inventory. */
export const README_SEED_SET_IDS = ["base1", "gym1", "me02.5"];

const REQUIRED_SET_IDS = [
  ...new Set([...README_DISPLAY_SET_IDS, ...README_SEED_SET_IDS]),
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "docs",
  "screenshots",
  "manifest.json",
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, options = {}) {
  const res = await fetch(`${APP_URL}${pathname}`, {
    headers: { "Content-Type": "application/json", "Accept-Language": "en" },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname} → ${res.status}: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

async function waitForApp() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_URL}/api/sync/active`);
      if (res.ok) {
        console.log("App reachable at", APP_URL);
        return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(
    `App not reachable at ${APP_URL}. Start Next.js (npm run dev) first.`,
  );
}

async function getActiveSync() {
  return api("/api/sync/active");
}

async function waitForSyncIdle(label) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const active = await getActiveSync();
    const catalogStatus = active.catalogJob?.status ?? "idle";
    const setCardJobs = active.setCardsJobs?.length ?? 0;
    if (!active.catalogJob && setCardJobs === 0) {
      return active;
    }
    console.log(
      `  … ${label}: catalog=${catalogStatus}, set-card jobs=${setCardJobs}`,
    );
    await sleep(POLL_MS);
  }
  throw new Error(
    `Timeout waiting for sync jobs (${label}). Is the worker running (npm run worker)?`,
  );
}

async function triggerCatalogSync() {
  const res = await fetch(`${APP_URL}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "catalog" }),
  });
  if (res.status === 409) {
    console.log("Catalog sync already queued.");
    return;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Catalog sync failed: ${res.status} ${body}`);
  }
  console.log("Catalog sync enqueued.");
}

async function ensureCatalogSets() {
  console.log("\n1/3 Catalog sets");
  let active = await getActiveSync();
  if (active.setCount === 0) {
    await triggerCatalogSync();
    await waitForSyncIdle("catalog");
    active = await getActiveSync();
  }

  if (active.setCount === 0) {
    throw new Error(
      "No sets in catalog. Start the worker (npm run worker) and retry.",
    );
  }

  const { sets } = await api("/api/sets/list");
  const available = new Set((sets ?? []).map((set) => set.id));
  const missing = REQUIRED_SET_IDS.filter((setId) => !available.has(setId));

  if (missing.length > 0) {
    console.log("Missing sets in catalog:", missing.join(", "));
    await triggerCatalogSync();
    await waitForSyncIdle("catalog-resync");

    const refreshed = await api("/api/sets/list");
    const refreshedIds = new Set((refreshed.sets ?? []).map((set) => set.id));
    const stillMissing = REQUIRED_SET_IDS.filter((setId) => !refreshedIds.has(setId));
    if (stillMissing.length > 0) {
      throw new Error(
        `Sets still missing after catalog sync: ${stillMissing.join(", ")}. ` +
          "Add them to CATALOG_SET_IDS in .env and restart the worker.",
      );
    }
  }

  console.log("Catalog ready for:", REQUIRED_SET_IDS.join(", "));
}

async function ensureSetCardsSynced() {
  console.log("\n2/3 Set cards");
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { sets: statuses } = await api(
      `/api/sync/set-cards?setIds=${REQUIRED_SET_IDS.join(",")}`,
    );
    const missing = statuses.filter((row) => !row.cardsSyncedAt);

    if (missing.length === 0) {
      console.log("Set cards ready for:", REQUIRED_SET_IDS.join(", "));
      return;
    }

    for (const row of missing) {
      if (!row.activeJob) {
        console.log(`  enqueue cards: ${row.setId}`);
        await api("/api/sync/set-cards", {
          method: "POST",
          body: JSON.stringify({ setId: row.setId }),
        });
      }
    }

    await waitForSyncIdle(`set-cards (${missing.map((row) => row.setId).join(", ")})`);
  }

  throw new Error(
    `Timeout syncing set cards. Is the worker running (npm run worker)?`,
  );
}

function runSeedScript() {
  return new Promise((resolve, reject) => {
    const seedPath = path.join(__dirname, "seed-readme-demo.mjs");
    const child = spawn("node", [seedPath], {
      stdio: "inherit",
      env: { ...process.env, APP_URL },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`seed-readme-demo.mjs exited with code ${code}`));
      }
    });
  });
}

async function seedDemoData() {
  console.log("\n3/3 Demo collections");
  await runSeedScript();
}

async function loadCollectionIds() {
  const { items } = await api("/api/collections");
  const byName = new Map((items ?? []).map((item) => [item.name, item.id]));

  const baseSetMasterId = byName.get("Base Set Master");
  const gradedChaseId = byName.get("Graded Chase Cards");

  if (!baseSetMasterId || !gradedChaseId) {
    throw new Error(
      "Expected collections after seed: Base Set Master, Graded Chase Cards",
    );
  }

  return { baseSetMasterId, gradedChaseId };
}

function buildManifest({ baseSetMasterId, gradedChaseId }) {
  return {
    appUrl: APP_URL,
    locale: "en",
    viewport: "393x852x3,mobile,touch",
    expectedSize: { width: 1179, height: 2556 },
    collections: {
      baseSetMaster: baseSetMasterId,
      gradedChaseCards: gradedChaseId,
    },
    sets: {
      display: README_DISPLAY_SET_IDS,
      seed: README_SEED_SET_IDS,
    },
    initScript:
      "document.cookie = 'ui_language=en;path=/;max-age=31536000;samesite=lax';",
    sessionStorageClear: {
      sets: "sets-page-state",
      search: "search-page-state",
    },
    beforeScreenshots: [
      "Set devIndicators: false in next.config.ts",
      "Restart npm run dev",
    ],
    afterScreenshots: [
      "Revert devIndicators in next.config.ts",
      "Restart npm run dev",
    ],
    screenshots: [
      { file: "01-dashboard.png", url: "/" },
      {
        file: "02-sets.png",
        url: "/sets",
        clearSessionStorage: ["sets-page-state"],
      },
      { file: "03-set-detail.png", url: "/sets/base1" },
      {
        file: "04-card-preview.png",
        url: "/sets/base1",
        actions: [{ type: "click", target: "Charizard BS · 4" }],
      },
      {
        file: "05-search.png",
        url: "/search",
        clearSessionStorage: ["search-page-state"],
        actions: [
          { type: "click", target: "Search all sets" },
          { type: "fill", target: "search", value: "charizard" },
          { type: "press", key: "Enter" },
          { type: "waitFor", target: "Charizard", timeoutMs: 30_000 },
        ],
      },
      { file: "06-collections.png", url: "/collections" },
      {
        file: "07-collection-checklist.png",
        url: `/collections/${baseSetMasterId}`,
        actions: [{ type: "click", target: "In inventory" }],
      },
      {
        file: "08-card-modal.png",
        url: `/collections/${baseSetMasterId}`,
        actions: [
          { type: "click", target: "In inventory" },
          { type: "click", target: "Charizard BS · 4" },
          { type: "waitFor", target: "Add to inventory", timeoutMs: 10_000 },
        ],
      },
      {
        file: "09-collection-inventory.png",
        url: `/collections/${baseSetMasterId}?view=entries`,
      },
      {
        file: "10-custom-collection.png",
        url: `/collections/${gradedChaseId}`,
      },
    ],
  };
}

async function main() {
  console.log("Preparing README screenshot data at", APP_URL);

  await waitForApp();
  await ensureCatalogSets();
  await ensureSetCardsSynced();
  await seedDemoData();

  const collectionIds = await loadCollectionIds();
  const manifest = buildManifest(collectionIds);

  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("\nDone.");
  console.log("Manifest:", MANIFEST_PATH);
  console.log("Base Set Master:", collectionIds.baseSetMasterId);
  console.log("Graded Chase Cards:", collectionIds.gradedChaseId);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
