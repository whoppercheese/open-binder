ALTER TABLE "collections" ADD COLUMN "cover_card_id" text;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_cover_card_id_cards_id_fk" FOREIGN KEY ("cover_card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;
