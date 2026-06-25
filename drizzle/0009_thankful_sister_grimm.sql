ALTER TABLE "agency" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "price_id" text;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "trial_ends_at" timestamp;