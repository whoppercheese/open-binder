CREATE TYPE "public"."collection_type" AS ENUM('set', 'custom');--> statement-breakpoint
TRUNCATE TABLE "user_cards";--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"type" "collection_type" NOT NULL,
	"set_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_cards" (
	"collection_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_cards_collection_card_idx" UNIQUE("collection_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_set_id_idx" ON "collections" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "collection_cards_collection_id_idx" ON "collection_cards" USING btree ("collection_id");--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "collection_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_cards_collection_id_idx" ON "user_cards" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "user_cards_collection_variant_idx" ON "user_cards" USING btree ("collection_id","variant_id");
