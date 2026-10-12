CREATE TABLE "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" text,
	"plan" text,
	"dedupe_key" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_events_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "funnel_events_name_chk" CHECK ("funnel_events"."name" IN ('invite_viewed', 'plans_opened', 'purchase_started', 'subscribed', 'cancelled')),
	CONSTRAINT "funnel_events_source_chk" CHECK ("funnel_events"."source" IS NULL OR "funnel_events"."source" IN ('league', 'duel', 'cosmetics', 'retrospective', 'direct')),
	CONSTRAINT "funnel_events_plan_chk" CHECK ("funnel_events"."plan" IS NULL OR "funnel_events"."plan" IN ('monthly', 'annual', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_events_name_created_idx" ON "funnel_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_user_idx" ON "funnel_events" USING btree ("user_id");