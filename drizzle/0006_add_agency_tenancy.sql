-- Multi-tenancy: introduce the `agency` tenant and scope all business data to it.
-- This migration is data-safe: it backfills every existing row into a single
-- seed agency before enforcing NOT NULL, so it can run against a populated DB.

CREATE TABLE "agency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agency_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- Seed agency: every pre-existing row belongs to this original tenant.
INSERT INTO "agency" ("id", "name", "slug", "status")
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Agency', 'demo-agency', 'active');
--> statement-breakpoint

ALTER TABLE "booking" DROP CONSTRAINT "booking_reference_unique";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT "product_reference_unique";--> statement-breakpoint

-- Add tenant columns as NULLABLE first so the ALTER succeeds on existing rows.
ALTER TABLE "activity_log" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill every existing row into the seed agency.
UPDATE "activity_log" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
UPDATE "booking" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
UPDATE "client" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
UPDATE "notification" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
UPDATE "opportunity" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
UPDATE "product" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint
-- Existing users all belong to the original agency. (Platform admins, added later,
-- intentionally keep agency_id NULL — so this column stays nullable.)
UPDATE "user" SET "agency_id" = '00000000-0000-0000-0000-000000000001' WHERE "agency_id" IS NULL;--> statement-breakpoint

-- Now enforce NOT NULL on the tenant-root tables (user stays nullable).
ALTER TABLE "activity_log" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "agency_id" SET NOT NULL;--> statement-breakpoint

CREATE INDEX "agency_slug_idx" ON "agency" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_agency_idx" ON "activity_log" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "booking_agency_idx" ON "booking" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "client_agency_idx" ON "client" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "notification_agency_idx" ON "notification" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "opportunity_agency_idx" ON "opportunity" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "product_agency_idx" ON "product" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "user_agency_idx" ON "user" USING btree ("agency_id");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_agency_reference_unique" UNIQUE("agency_id","reference");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_agency_reference_unique" UNIQUE("agency_id","reference");
