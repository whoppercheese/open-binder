ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "illustrator" text;

CREATE INDEX IF NOT EXISTS "cards_illustrator_idx"
  ON "cards" (lower("illustrator"));
