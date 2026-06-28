CREATE TABLE "booking_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"booking_item_id" uuid,
	"type" text NOT NULL,
	"provider_id" text,
	"url" text,
	"raw_data" jsonb,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"event" text NOT NULL,
	"provider_id" text,
	"correlation_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_idempotency" (
	"key" text PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"booking_item_id" uuid,
	"provider_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"supplier_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_supplier_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"booking_item_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"confirmation_number" text NOT NULL,
	"pnr" text,
	"supplier_order_id" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_traveller" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "booking_traveller" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "booking_document" ADD CONSTRAINT "booking_document_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_document" ADD CONSTRAINT "booking_document_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_idempotency" ADD CONSTRAINT "booking_idempotency_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_idempotency" ADD CONSTRAINT "booking_idempotency_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_supplier_ref" ADD CONSTRAINT "booking_supplier_ref_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_supplier_ref" ADD CONSTRAINT "booking_supplier_ref_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_document_booking_idx" ON "booking_document" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_document_item_idx" ON "booking_document" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "booking_document_type_idx" ON "booking_document" USING btree ("type");--> statement-breakpoint
CREATE INDEX "booking_event_booking_idx" ON "booking_event" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_event_agency_idx" ON "booking_event" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "booking_event_event_idx" ON "booking_event" USING btree ("event");--> statement-breakpoint
CREATE INDEX "booking_event_created_idx" ON "booking_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "booking_event_booking_created_idx" ON "booking_event" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_idempotency_booking_idx" ON "booking_idempotency" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_idempotency_expires_idx" ON "booking_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "booking_supplier_ref_booking_idx" ON "booking_supplier_ref" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_supplier_ref_item_idx" ON "booking_supplier_ref" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "booking_supplier_ref_provider_idx" ON "booking_supplier_ref" USING btree ("provider_id");