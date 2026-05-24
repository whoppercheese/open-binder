-- i18n catalog: JSONB names + search vectors table

ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "names" jsonb NOT NULL DEFAULT '{}';
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "series_names" jsonb NOT NULL DEFAULT '{}';

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "names" jsonb NOT NULL DEFAULT '{}';

UPDATE "cards"
SET "names" = jsonb_strip_nulls(jsonb_build_object(
  'de', "name_de",
  'en', "name_en"
))
WHERE "names" = '{}'::jsonb;

UPDATE "sets"
SET
  "names" = jsonb_strip_nulls(jsonb_build_object('de', "name_de")),
  "series_names" = jsonb_strip_nulls(jsonb_build_object('de', "series_name"))
WHERE "names" = '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "catalog_search_vectors" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "locale" text NOT NULL,
  "search_vector" tsvector NOT NULL,
  PRIMARY KEY ("entity_type", "entity_id", "locale")
);

CREATE INDEX IF NOT EXISTS "catalog_search_vectors_gin"
  ON "catalog_search_vectors" USING gin ("search_vector");

-- Backfill search vectors for en/de from JSONB names
INSERT INTO "catalog_search_vectors" ("entity_type", "entity_id", "locale", "search_vector")
SELECT
  'card',
  c.id,
  'en',
  to_tsvector(
    'english',
    coalesce(c.names->>'en', '') || ' ' ||
    coalesce(c.number, '') || ' ' ||
    coalesce(s.names->>'en', '') || ' ' ||
    coalesce(s.official_code, '')
  )
FROM cards c
INNER JOIN sets s ON s.id = c.set_id
ON CONFLICT ("entity_type", "entity_id", "locale")
DO UPDATE SET search_vector = EXCLUDED.search_vector;

INSERT INTO "catalog_search_vectors" ("entity_type", "entity_id", "locale", "search_vector")
SELECT
  'card',
  c.id,
  'de',
  to_tsvector(
    'german',
    coalesce(c.names->>'de', c.names->>'en', '') || ' ' ||
    coalesce(c.number, '') || ' ' ||
    coalesce(s.names->>'de', s.names->>'en', '') || ' ' ||
    coalesce(s.official_code, '')
  )
FROM cards c
INNER JOIN sets s ON s.id = c.set_id
ON CONFLICT ("entity_type", "entity_id", "locale")
DO UPDATE SET search_vector = EXCLUDED.search_vector;

DROP INDEX IF EXISTS "cards_search_vector_idx";
ALTER TABLE "cards" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "cards" DROP COLUMN IF EXISTS "name_de";
ALTER TABLE "cards" DROP COLUMN IF EXISTS "name_en";
ALTER TABLE "cards" DROP COLUMN IF EXISTS "name_source";
ALTER TABLE "sets" DROP COLUMN IF EXISTS "name_de";
ALTER TABLE "sets" DROP COLUMN IF EXISTS "series_name";
