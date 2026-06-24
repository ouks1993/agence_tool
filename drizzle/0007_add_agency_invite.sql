CREATE TABLE "agency_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agency_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "agency_invite" ADD CONSTRAINT "agency_invite_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invite" ADD CONSTRAINT "agency_invite_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_invite_agency_idx" ON "agency_invite" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "agency_invite_email_idx" ON "agency_invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX "agency_invite_token_idx" ON "agency_invite" USING btree ("token");