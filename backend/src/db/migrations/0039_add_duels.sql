CREATE TABLE "duels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenger_id" uuid NOT NULL,
	"opponent_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"reason" text,
	"challenger_pct" double precision,
	"opponent_pct" double precision,
	"challenger_operated" boolean,
	"opponent_operated" boolean,
	"xp_awarded_at" timestamp with time zone,
	CONSTRAINT "duels_status_chk" CHECK ("duels"."status" IN ('pending', 'active', 'finished', 'declined', 'cancelled', 'expired')),
	CONSTRAINT "duels_outcome_chk" CHECK ("duels"."outcome" IN ('challenger', 'opponent', 'draw')),
	CONSTRAINT "duels_distinct_players_chk" CHECK ("duels"."challenger_id" <> "duels"."opponent_id")
);
--> statement-breakpoint
ALTER TABLE "social_feed_events" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "duels_challenger_idx" ON "duels" USING btree ("challenger_id");--> statement-breakpoint
CREATE INDEX "duels_opponent_idx" ON "duels" USING btree ("opponent_id");--> statement-breakpoint
CREATE INDEX "duels_status_ends_idx" ON "duels" USING btree ("status","ends_at");