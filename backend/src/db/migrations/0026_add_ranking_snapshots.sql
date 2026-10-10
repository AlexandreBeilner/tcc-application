CREATE TABLE "ranking_snapshots" (
	"run_id" uuid NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"window_kind" text NOT NULL,
	"criterion" text NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"username" text NOT NULL,
	"level" integer NOT NULL,
	"xp" integer NOT NULL,
	"profitability_pct" double precision,
	"sort_key" double precision NOT NULL,
	CONSTRAINT "ranking_snapshots_run_id_window_kind_criterion_user_id_pk" PRIMARY KEY("run_id","window_kind","criterion","user_id"),
	CONSTRAINT "ranking_snapshots_window_chk" CHECK ("ranking_snapshots"."window_kind" IN ('week', 'month', 'none'))
);
--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranking_snapshots_computed_at_idx" ON "ranking_snapshots" USING btree ("computed_at");