ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "name_en" text;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "name_source" text DEFAULT 'de' NOT NULL;
--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "name_de" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cards_set_number_idx" ON "cards" ("set_id", "number");
