CREATE TABLE "commission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"booking_id" uuid,
	"booking_item_id" uuid,
	"supplier_id" uuid,
	"agent_user_id" text,
	"type" text NOT NULL,
	"basis" text DEFAULT 'percent' NOT NULL,
	"rate" numeric(5, 2),
	"base_amount" numeric(12, 2),
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "commission_rate_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_agent_user_id_user_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_agency_idx" ON "commission" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "commission_booking_idx" ON "commission" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "commission_type_idx" ON "commission" USING btree ("type");--> statement-breakpoint
CREATE INDEX "commission_agent_idx" ON "commission" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "commission_status_idx" ON "commission" USING btree ("status");