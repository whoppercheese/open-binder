ALTER TYPE "sync_job_type" ADD VALUE IF NOT EXISTS 'set_cards';
--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "set_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "cards_synced_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sets" s
SET "cards_synced_at" = NOW()
WHERE "cards_synced_at" IS NULL
  AND EXISTS (SELECT 1 FROM "cards" c WHERE c."set_id" = s."id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_jobs_set_id_status_idx" ON "sync_jobs" ("set_id", "status");
