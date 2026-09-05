ALTER TABLE "products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "delivery_time" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "preparation_time" text;