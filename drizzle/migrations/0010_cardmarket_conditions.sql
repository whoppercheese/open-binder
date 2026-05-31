CREATE TYPE "public"."card_condition_new" AS ENUM('mt', 'nm', 'ex', 'gd', 'lp', 'pl', 'po');--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "condition" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "condition" TYPE "card_condition_new" USING (
  CASE "condition"::text
    WHEN 'mint' THEN 'mt'::card_condition_new
    WHEN 'nm' THEN 'nm'::card_condition_new
    WHEN 'lp' THEN 'lp'::card_condition_new
    WHEN 'mp' THEN 'pl'::card_condition_new
    WHEN 'hp' THEN 'po'::card_condition_new
  END
);--> statement-breakpoint
ALTER TABLE "user_cards" ALTER COLUMN "condition" SET DEFAULT 'nm'::card_condition_new;--> statement-breakpoint
DROP TYPE "public"."card_condition";--> statement-breakpoint
ALTER TYPE "public"."card_condition_new" RENAME TO "card_condition";--> statement-breakpoint
UPDATE "app_settings" SET "value" = CASE "value"
  WHEN 'mint' THEN 'mt'
  WHEN 'mp' THEN 'pl'
  WHEN 'hp' THEN 'po'
  ELSE "value"
END
WHERE "key" = 'default_condition';
