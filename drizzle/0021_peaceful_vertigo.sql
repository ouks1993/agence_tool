ALTER TABLE "commission" DROP CONSTRAINT "commission_booking_id_booking_id_fk";
--> statement-breakpoint
ALTER TABLE "commission" DROP CONSTRAINT "commission_booking_item_id_booking_item_id_fk";
--> statement-breakpoint
ALTER TABLE "portal_session" ADD COLUMN "purpose" text DEFAULT 'session' NOT NULL;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_item_idx" ON "commission" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "commission_supplier_idx" ON "commission" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "product_converted_booking_idx" ON "product" USING btree ("converted_booking_id");