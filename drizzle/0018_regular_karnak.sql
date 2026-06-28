ALTER TABLE "commission" DROP CONSTRAINT "commission_booking_item_id_booking_item_id_fk";
--> statement-breakpoint
ALTER TABLE "commission" ADD CONSTRAINT "commission_booking_item_id_booking_item_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_agency_status_idx" ON "booking" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "booking_agency_created_idx" ON "booking" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_item_supplier_idx" ON "booking_item" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "client_agency_created_idx" ON "client" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "commission_agency_status_idx" ON "commission" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "commission_agency_created_idx" ON "commission" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_agency_created_idx" ON "notification" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "opportunity_agency_stage_idx" ON "opportunity" USING btree ("agency_id","stage");--> statement-breakpoint
CREATE INDEX "opportunity_agency_created_idx" ON "opportunity" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_created_idx" ON "payment" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_agency_status_idx" ON "product" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "product_agency_created_idx" ON "product" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE INDEX "product_item_supplier_idx" ON "product_item" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");