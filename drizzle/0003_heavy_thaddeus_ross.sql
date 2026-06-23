CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"client_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"destination" text,
	"depart_date" timestamp,
	"return_date" timestamp,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "booking_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"supplier" text,
	"booking_ref" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"details" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_traveller" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"passport_number" text,
	"passport_expiry" timestamp,
	"nationality" text,
	"date_of_birth" timestamp,
	"passport_issue_date" timestamp,
	"passport_issue_place" text,
	"is_lead" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_item" ADD CONSTRAINT "booking_item_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_traveller" ADD CONSTRAINT "booking_traveller_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_client_idx" ON "booking" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_depart_idx" ON "booking" USING btree ("depart_date");--> statement-breakpoint
CREATE INDEX "booking_item_booking_idx" ON "booking_item" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_traveller_booking_idx" ON "booking_traveller" USING btree ("booking_id");