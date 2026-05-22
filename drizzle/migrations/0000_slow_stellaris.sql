CREATE TYPE "public"."card_condition" AS ENUM('mint', 'nm', 'lp', 'mp', 'hp');--> statement-breakpoint
CREATE TYPE "public"."card_language" AS ENUM('de', 'en');--> statement-breakpoint
CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_job_type" AS ENUM('catalog', 'prices');--> statement-breakpoint
CREATE TYPE "public"."variant_type" AS ENUM('normal', 'holo', 'reverse_holo', 'first_edition');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_prices" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"trend_eur" numeric(12, 2),
	"low_eur" numeric(12, 2),
	"avg_eur" numeric(12, 2),
	"source" text DEFAULT 'tcgdex' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" text NOT NULL,
	"variant_type" "variant_type" NOT NULL,
	"cardmarket_product_id" integer,
	"tcgdx_variant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardmarket_products" (
	"id_product" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"id_expansion" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"number" text NOT NULL,
	"name_de" text NOT NULL,
	"rarity" text,
	"image_url" text,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name_de" text NOT NULL,
	"series_id" text NOT NULL,
	"series_name" text NOT NULL,
	"release_date" text,
	"logo_url" text,
	"symbol_url" text,
	"official_code" text,
	"card_count_total" integer DEFAULT 0 NOT NULL,
	"card_count_official" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" "sync_job_type" NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"condition" "card_condition" DEFAULT 'nm' NOT NULL,
	"language" "card_language" DEFAULT 'de' NOT NULL,
	"notes" text,
	"purchase_price" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_prices" ADD CONSTRAINT "card_prices_variant_id_card_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_variants" ADD CONSTRAINT "card_variants_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_variant_id_card_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_variants_card_type_idx" ON "card_variants" USING btree ("card_id","variant_type");--> statement-breakpoint
CREATE INDEX "card_variants_cm_product_idx" ON "card_variants" USING btree ("cardmarket_product_id");--> statement-breakpoint
CREATE INDEX "cardmarket_products_name_idx" ON "cardmarket_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cards_set_id_idx" ON "cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "cards_number_idx" ON "cards" USING btree ("number");--> statement-breakpoint
CREATE INDEX "cards_search_vector_idx" ON "cards" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "user_cards_variant_idx" ON "user_cards" USING btree ("variant_id");