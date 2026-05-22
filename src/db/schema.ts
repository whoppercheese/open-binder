import {
  customType,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
  "mint",
  "nm",
  "lp",
  "mp",
  "hp",
]);

export const languageEnum = pgEnum("card_language", ["de", "en"]);

export const syncJobTypeEnum = pgEnum("sync_job_type", [
  "catalog",
  "prices",
]);

export const syncJobStatusEnum = pgEnum("sync_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  nameDe: text("name_de").notNull(),
  seriesId: text("series_id").notNull(),
  seriesName: text("series_name").notNull(),
  releaseDate: text("release_date"),
  logoUrl: text("logo_url"),
  symbolUrl: text("symbol_url"),
  officialCode: text("official_code"),
  cardCountTotal: integer("card_count_total").notNull().default(0),
  cardCountOfficial: integer("card_count_official").notNull().default(0),
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
    nameDe: text("name_de").notNull(),
    rarity: text("rarity"),
    imageUrl: text("image_url"),
    searchVector: tsvector("search_vector"),
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
    index("cards_search_vector_idx").using("gin", table.searchVector),
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

export const userCards = pgTable(
  "user_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => cardVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    condition: conditionEnum("condition").notNull().default("nm"),
    language: languageEnum("language").notNull().default("de"),
    notes: text("notes"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_cards_variant_idx").on(table.variantId)],
);

export const syncJobs = pgTable("sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: syncJobTypeEnum("job_type").notNull(),
  status: syncJobStatusEnum("status").notNull().default("pending"),
  message: text("message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

export const userCardsRelations = relations(userCards, ({ one }) => ({
  variant: one(cardVariants, {
    fields: [userCards.variantId],
    references: [cardVariants.id],
  }),
}));

export const searchVectorExpression = sql`to_tsvector('german', coalesce(${cards.nameDe}, '') || ' ' || coalesce(${cards.number}, '') || ' ' || coalesce(${sets.nameDe}, '') || ' ' || coalesce(${sets.officialCode}, ''))`;
