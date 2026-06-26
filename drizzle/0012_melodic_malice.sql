ALTER TABLE "agency" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "stripe_connect_onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "stripe_session_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "checkout_url" text;