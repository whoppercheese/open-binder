import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { SyncJobProgress } from "@/lib/sync-job-display";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const variantTypeEnum = pgEnum("variant_type", [
  "normal",
  "holo",
  "reverse_holo",
  "first_edition",
]);

export const conditionEnum = pgEnum("card_condition", [
  "mt",
  "nm",
  "ex",
  "gd",
  "lp",
  "pl",
  "po",
]);

export const languageEnum = pgEnum("card_language", ["de", "en"]);

export const syncJobTypeEnum = pgEnum("sync_job_type", [
  "catalog",
  "set_cards",
  "prices",
]);

export const syncJobStatusEnum = pgEnum("sync_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const collectionTypeEnum = pgEnum("collection_type", ["set", "custom"]);

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  names: jsonb("names").$type<Record<string, string>>().notNull().default({}),
  seriesId: text("series_id").notNull(),
  seriesNames: jsonb("series_names")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  releaseDate: text("release_date"),
  logoUrl: text("logo_url"),
  symbolUrl: text("symbol_url"),
  officialCode: text("official_code"),
  cardCountTotal: integer("card_count_total").notNull().default(0),
  cardCountOfficial: integer("card_count_official").notNull().default(0),
  cardsSyncedAt: timestamp("cards_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    names: jsonb("names").$type<Record<string, string>>().notNull().default({}),
    rarity: text("rarity"),
    illustrator: text("illustrator"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cards_set_id_idx").on(table.setId),
    index("cards_number_idx").on(table.number),
    index("cards_illustrator_idx").on(table.illustrator),
    uniqueIndex("cards_set_number_idx").on(table.setId, table.number),
  ],
);

export const catalogSearchVectors = pgTable(
  "catalog_search_vectors",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    locale: text("locale").notNull(),
    searchVector: tsvector("search_vector").notNull(),
  },
  (table) => [
    index("catalog_search_vectors_gin").using("gin", table.searchVector),
  ],
);

export const cardVariants = pgTable(
  "card_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    variantType: variantTypeEnum("variant_type").notNull(),
    cardmarketProductId: integer("cardmarket_product_id"),
    tcgdxVariantId: text("tcgdx_variant_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("card_variants_card_type_idx").on(
      table.cardId,
      table.variantType,
    ),
    index("card_variants_cm_product_idx").on(table.cardmarketProductId),
  ],
);

export const cardPrices = pgTable(
  "card_prices",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => cardVariants.id, { onDelete: "cascade" }),
    trendEur: numeric("trend_eur", { precision: 12, scale: 2 }),
    lowEur: numeric("low_eur", { precision: 12, scale: 2 }),
    avgEur: numeric("avg_eur", { precision: 12, scale: 2 }),
    source: text("source").notNull().default("tcgdex"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    coverCardId: text("cover_card_id").references(() => cards.id, {
      onDelete: "set null",
    }),
    type: collectionTypeEnum("type").notNull(),
    setId: text("set_id").references(() => sets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("collections_set_id_idx").on(table.setId)],
);

export const collectionCards = pgTable(
  "collection_cards",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("collection_cards_collection_card_idx").on(
      table.collectionId,
      table.cardId,
    ),
    index("collection_cards_collection_id_idx").on(table.collectionId),
  ],
);

export const userCards = pgTable(
  "user_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => cardVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    condition: conditionEnum("condition").notNull().default("nm"),
    language: languageEnum("language").notNull().default("de"),
    notes: text("notes"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_cards_variant_idx").on(table.variantId),
    index("user_cards_collection_id_idx").on(table.collectionId),
    index("user_cards_collection_variant_idx").on(
      table.collectionId,
      table.variantId,
    ),
  ],
);

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobType: syncJobTypeEnum("job_type").notNull(),
    setId: text("set_id").references(() => sets.id, { onDelete: "set null" }),
    status: syncJobStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    progress: jsonb("progress").$type<SyncJobProgress>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sync_jobs_set_id_status_idx").on(table.setId, table.status)],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cardmarketProducts = pgTable(
  "cardmarket_products",
  {
    idProduct: integer("id_product").primaryKey(),
    name: text("name").notNull(),
    idExpansion: integer("id_expansion"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cardmarket_products_name_idx").on(table.name)],
);

export const setsRelations = relations(sets, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  set: one(sets, { fields: [cards.setId], references: [sets.id] }),
  variants: many(cardVariants),
}));

export const cardVariantsRelations = relations(cardVariants, ({ one, many }) => ({
  card: one(cards, { fields: [cardVariants.cardId], references: [cards.id] }),
  price: one(cardPrices, {
    fields: [cardVariants.id],
    references: [cardPrices.variantId],
  }),
  userCards: many(userCards),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  set: one(sets, { fields: [collections.setId], references: [sets.id] }),
  coverCard: one(cards, {
    fields: [collections.coverCardId],
    references: [cards.id],
  }),
  userCards: many(userCards),
  collectionCards: many(collectionCards),
}));

export const collectionCardsRelations = relations(collectionCards, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionCards.collectionId],
    references: [collections.id],
  }),
  card: one(cards, {
    fields: [collectionCards.cardId],
    references: [cards.id],
  }),
}));

export const userCardsRelations = relations(userCards, ({ one }) => ({
  collection: one(collections, {
    fields: [userCards.collectionId],
    references: [collections.id],
  }),
  variant: one(cardVariants, {
    fields: [userCards.variantId],
    references: [cardVariants.id],
  }),
}));

