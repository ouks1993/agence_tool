CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"entity_label" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'individual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"address" text,
	"city" text,
	"country" text,
	"source" text,
	"notes" text,
	"owner_id" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"client_id" uuid NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"probability" integer DEFAULT 10 NOT NULL,
	"destination" text,
	"travel_start_date" timestamp,
	"travel_end_date" timestamp,
	"pax_count" integer DEFAULT 1 NOT NULL,
	"expected_close_date" timestamp,
	"lost_reason" text,
	"notes" text,
	"assigned_to_id" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"client_id" uuid,
	"opportunity_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"destination" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"pax_count" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"markup_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"summary" text,
	"valid_until" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "product_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"supplier" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"details" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'agent' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_opportunity_id_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_item" ADD CONSTRAINT "product_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_user_idx" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_owner_idx" ON "client" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "client_status_idx" ON "client" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_name_idx" ON "client" USING btree ("name");--> statement-breakpoint
CREATE INDEX "client_contact_client_idx" ON "client_contact" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "opportunity_client_idx" ON "opportunity" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "opportunity_stage_idx" ON "opportunity" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunity_assigned_idx" ON "opportunity" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "product_client_idx" ON "product" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "product_opportunity_idx" ON "product" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "product_status_idx" ON "product" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_item_product_idx" ON "product_item" USING btree ("product_id");