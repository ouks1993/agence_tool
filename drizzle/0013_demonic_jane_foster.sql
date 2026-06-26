CREATE TABLE "portal_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portal_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "portal_session" ADD CONSTRAINT "portal_session_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_session_client_idx" ON "portal_session" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "portal_session_token_idx" ON "portal_session" USING btree ("token");