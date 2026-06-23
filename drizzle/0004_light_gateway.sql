CREATE TABLE "booking_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"title" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"kind" text DEFAULT 'payment' NOT NULL,
	"method" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"reference" text,
	"note" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "booking_item" ADD COLUMN "item_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_item" ADD COLUMN "confirmation_number" text;--> statement-breakpoint
ALTER TABLE "booking_item" ADD COLUMN "day_index" integer;--> statement-breakpoint
ALTER TABLE "booking_day" ADD CONSTRAINT "booking_day_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_day_booking_idx" ON "booking_day" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_share_token_unique" UNIQUE("share_token");