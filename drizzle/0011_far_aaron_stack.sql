CREATE TABLE "hotel_content" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"hotel_type" text,
	"description" text,
	"address" text,
	"city" text,
	"country" text,
	"postal_code" text,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"destination_code" text,
	"segments" jsonb,
	"facilities" jsonb,
	"images" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hotel_content_destination_idx" ON "hotel_content" USING btree ("destination_code");