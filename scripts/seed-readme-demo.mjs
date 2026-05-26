#!/usr/bin/env node
/**
 * Seeds realistic demo data for README screenshots (English UI).
 * Run: node scripts/seed-readme-demo.mjs
 */
const BASE = process.env.APP_URL ?? "http://localhost:3000";

/** Unique checklist cards with inventory → ~24% of Base Set (102). */
const BASE1_TARGET_OWNED = 24;
/** Unique checklist cards with inventory → ~5% of Gym Heroes (132). */
const GYM1_TARGET_OWNED = 7;
/** Target completion percent for Ascended Heroes (me02.5). */
const ME02_5_TARGET_PERCENT = 42;

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
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
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getCard(cardId) {
  return api(`/api/cards/${cardId}`);
}

async function getSetCards(setId) {
  const data = await api(`/api/sets/${setId}`);
  return data.cards ?? [];
}

async function addInventory(collectionId, variantId, fields) {
  return api("/api/collection", {
    method: "POST",
    body: JSON.stringify({
      collectionId,
      variantId,
      quantity: 1,
      condition: "nm",
      language: "en",
      ...fields,
    }),
  });
}

function variantByType(card, type) {
  const v = card.variants.find((x) => x.variantType === type);
  if (!v) throw new Error(`No variant ${type} on ${card.id}`);
  return v.id;
}

function defaultVariantType(card) {
  const order = ["holo", "normal", "reverse_holo", "first_edition"];
  for (const type of order) {
    if (card.variants.some((v) => v.variantType === type)) {
      return type;
    }
  }
  return card.variants[0]?.variantType;
}

async function seedInventoryEntries(collectionId, specs) {
  for (const spec of specs) {
    const card = await getCard(spec.id);
    for (const entry of spec.entries) {
      const variant =
        entry.variant ?? defaultVariantType(card) ?? card.variants[0].variantType;
      const variantId = variantByType(card, variant);
      await addInventory(collectionId, variantId, entry);
      console.log("  +", card.name, variant, entry.condition ?? "nm");
    }
  }
}

async function seedBulkOwned(collectionId, setId, targetOwned, detailedSpecs) {
  const detailedIds = new Set(detailedSpecs.map((s) => s.id));
  const setCards = await getSetCards(setId);
  const ownedIds = new Set(detailedIds);

  await seedInventoryEntries(collectionId, detailedSpecs);

  for (const row of setCards) {
    if (ownedIds.size >= targetOwned) break;
    if (ownedIds.has(row.id)) continue;

    const card = await getCard(row.id);
    const variant = defaultVariantType(card);
    if (!variant) continue;

    await addInventory(collectionId, variantByType(card, variant), {});
    ownedIds.add(row.id);
    if (targetOwned <= 20) {
      console.log("  +", card.name, variant, "nm (bulk)");
    }
  }
  if (targetOwned > 20) {
    console.log(`  + ${ownedIds.size - detailedIds.size} cards (bulk)`);
  }

  const { progress } = await api(`/api/collections/${collectionId}`);
  console.log(
    `  → ${setId}: ${progress.ownedCount}/${progress.totalCount} (${progress.percent}%)`,
  );
}

async function main() {
  console.log("Seeding demo collections at", BASE);

  const existing = await api("/api/collections");
  for (const item of existing.items ?? []) {
    await api(`/api/collections/${item.id}`, { method: "DELETE" });
    console.log("Removed old collection:", item.name);
  }

  const master = await api("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      type: "set",
      setId: "base1",
      name: "Base Set Master",
    }),
  });
  const masterId = master.collection.id;
  console.log("Created:", master.collection.name, masterId);

  const gym = await api("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      type: "set",
      setId: "gym1",
      name: "Gym Heroes",
    }),
  });
  const gymId = gym.collection.id;
  console.log("Created:", gym.collection.name, gymId);

  const ascended = await api("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      type: "set",
      setId: "me02.5",
      name: "Ascended Heroes",
    }),
  });
  const ascendedId = ascended.collection.id;
  console.log("Created:", ascended.collection.name, ascendedId);

  const chase = await api("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      type: "custom",
      name: "Graded Chase Cards",
    }),
  });
  const chaseId = chase.collection.id;
  console.log("Created:", chase.collection.name, chaseId);

  const base1Detailed = [
    {
      id: "base1-4",
      entries: [
        {
          variant: "holo",
          condition: "nm",
          language: "en",
          quantity: 1,
          notes: "Raw copy — strong holo, slight edge whitening on back",
        },
        {
          variant: "first_edition",
          condition: "lp",
          language: "en",
          quantity: 1,
          notes: "1st Edition — PSA candidate, light holo scratches",
          flagged: true,
        },
      ],
    },
    {
      id: "base1-2",
      entries: [{ variant: "holo", condition: "nm", language: "en", notes: "Holo Blastoise — binder kept" }],
    },
    { id: "base1-15", entries: [{ variant: "holo", condition: "mp", language: "en", notes: "Played as kid, still displays well" }] },
    { id: "base1-58", entries: [{ variant: "normal", condition: "nm", language: "en", quantity: 2, notes: "Duplicate commons for trades" }] },
    { id: "base1-10", entries: [{ variant: "holo", condition: "nm", language: "en", notes: "Mewtwo holo — centerpiece" }] },
    { id: "base1-1", entries: [{ variant: "holo", condition: "nm", language: "en" }] },
    { id: "base1-8", entries: [{ variant: "holo", condition: "hp", language: "en", notes: "Heavy play Machamp" }] },
  ];

  console.log("\nBase Set Master (~24%):");
  await seedBulkOwned(masterId, "base1", BASE1_TARGET_OWNED, base1Detailed);

  const gym1Detailed = [
    { id: "gym1-1", entries: [{ variant: "holo", condition: "nm", notes: "Blaine's Moltres — holo centerpiece" }] },
    { id: "gym1-14", entries: [{ variant: "holo", condition: "nm", notes: "Sabrina's Gengar" }] },
    { id: "gym1-9", entries: [{ variant: "holo", condition: "lp" }] },
    { id: "gym1-11", entries: [{ variant: "holo", condition: "nm" }] },
    { id: "gym1-6", entries: [{ variant: "holo", condition: "nm" }] },
    { id: "gym1-3", entries: [{ variant: "holo", condition: "mp" }] },
    { id: "gym1-12", entries: [{ variant: "holo", condition: "nm", notes: "Rocket's Moltres" }] },
  ];

  console.log("\nGym Heroes (~5%):");
  await seedInventoryEntries(gymId, gym1Detailed);

  const { progress: gymProgress } = await api(`/api/collections/${gymId}`);
  console.log(
    `  → gym1: ${gymProgress.ownedCount}/${gymProgress.totalCount} (${gymProgress.percent}%)`,
  );

  const ascendedCards = await getSetCards("me02.5");
  const ascendedTarget = Math.round(
    (ascendedCards.length * ME02_5_TARGET_PERCENT) / 100,
  );
  console.log(`\nAscended Heroes (~${ME02_5_TARGET_PERCENT}%):`);
  await seedBulkOwned(ascendedId, "me02.5", ascendedTarget, []);

  const { progress: ascendedProgress } = await api(`/api/collections/${ascendedId}`);

  const chaseCards = ["base1-4", "base1-10", "base1-15"];
  console.log("\nGraded Chase Cards:");
  for (const cardId of chaseCards) {
    await api(`/api/collections/${chaseId}/cards`, {
      method: "POST",
      body: JSON.stringify({ cardId }),
    });
    const card = await getCard(cardId);
    const variantId = variantByType(card, cardId === "base1-4" ? "first_edition" : "holo");
    await addInventory(chaseId, variantId, {
      condition: "nm",
      language: "en",
      notes: cardId === "base1-4" ? "Slab-ready 1st Ed Charizard" : "Display copy",
      flagged: cardId === "base1-4",
    });
    console.log("  +", card.name);
  }

  const { progress: masterProgress } = await api(`/api/collections/${masterId}`);
  const portfolio = await api("/api/portfolio");
  console.log("\nDone.");
  console.log(
    "Base Set Master:",
    `${masterProgress.ownedCount}/${masterProgress.totalCount} (${masterProgress.percent}%)`,
  );
  console.log(
    "Gym Heroes:",
    `${gymProgress.ownedCount}/${gymProgress.totalCount} (${gymProgress.percent}%)`,
  );
  console.log(
    "Ascended Heroes:",
    `${ascendedProgress.ownedCount}/${ascendedProgress.totalCount} (${ascendedProgress.percent}%)`,
  );
  const value = portfolio.totalValueEur ?? portfolio.valueEur;
  console.log("Portfolio:", value != null ? `€${Number(value).toFixed(2)}` : "—");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
