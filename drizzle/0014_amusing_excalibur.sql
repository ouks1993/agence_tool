CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"address" text,
	"city" text,
	"country" text,
	"contact_name" text,
	"notes" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_agency_name_unique" UNIQUE("agency_id","name")
);
--> statement-breakpoint
CREATE TABLE "supplier_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"commission_basis" text,
	"commission_rate" numeric(5, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"file_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"description" text NOT NULL,
	"net_rate" numeric(12, 2),
	"sell_rate" numeric(12, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_item" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "product_item" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contract" ADD CONSTRAINT "supplier_contract_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contract" ADD CONSTRAINT "supplier_contract_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_rate" ADD CONSTRAINT "supplier_rate_contract_id_supplier_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_agency_idx" ON "supplier" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "supplier_type_idx" ON "supplier" USING btree ("type");--> statement-breakpoint
CREATE INDEX "supplier_status_idx" ON "supplier" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_contract_supplier_idx" ON "supplier_contract" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_contract_agency_idx" ON "supplier_contract" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "supplier_contract_status_idx" ON "supplier_contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_rate_contract_idx" ON "supplier_rate" USING btree ("contract_id");--> statement-breakpoint
ALTER TABLE "booking_item" ADD CONSTRAINT "booking_item_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_item" ADD CONSTRAINT "product_item_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;