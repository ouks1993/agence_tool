ALTER TABLE "product" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "declined_at" timestamp;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "signer_name" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "signer_email" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "signature_data" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "signer_ip" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "signer_user_agent" text;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_share_token_unique" UNIQUE("share_token");