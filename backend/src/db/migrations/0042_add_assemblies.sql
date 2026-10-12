CREATE TABLE "assemblies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_ref" text NOT NULL,
	"dedupe_key" varchar(200) NOT NULL,
	"status" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"effect_applies_at" timestamp with time zone NOT NULL,
	"outcome" text,
	"outcome_reason" text,
	"winning_option_id" uuid,
	"voter_count" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assemblies_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "assemblies_status_chk" CHECK ("assemblies"."status" IN ('scheduled', 'open', 'closed')),
	CONSTRAINT "assemblies_outcome_chk" CHECK ("assemblies"."outcome" IS NULL OR "assemblies"."outcome" IN ('approved', 'not_approved')),
	CONSTRAINT "assemblies_schedule_chk" CHECK ("assemblies"."snapshot_at" <= "assemblies"."opens_at" AND "assemblies"."opens_at" < "assemblies"."closes_at" AND "assemblies"."closes_at" <= "assemblies"."effect_applies_at")
);
--> statement-breakpoint
CREATE TABLE "assembly_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assembly_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"gain" text NOT NULL,
	"loss" text NOT NULL,
	"effect" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "assembly_options_assembly_key_unique" UNIQUE("assembly_id","key")
);
--> statement-breakpoint
CREATE TABLE "assembly_vote_credits" (
	"user_id" uuid NOT NULL,
	"assembly_id" uuid NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assembly_vote_credits_user_id_assembly_id_pk" PRIMARY KEY("user_id","assembly_id")
);
--> statement-breakpoint
CREATE TABLE "assembly_votes" (
	"assembly_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assembly_votes_assembly_id_user_id_pk" PRIMARY KEY("assembly_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "assembly_options" ADD CONSTRAINT "assembly_options_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_vote_credits" ADD CONSTRAINT "assembly_vote_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_vote_credits" ADD CONSTRAINT "assembly_vote_credits_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_votes" ADD CONSTRAINT "assembly_votes_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_votes" ADD CONSTRAINT "assembly_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_votes" ADD CONSTRAINT "assembly_votes_option_id_assembly_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."assembly_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assemblies_status_closes_idx" ON "assemblies" USING btree ("status","closes_at");--> statement-breakpoint
CREATE INDEX "assemblies_kind_subject_idx" ON "assemblies" USING btree ("kind","subject_ref");--> statement-breakpoint
CREATE INDEX "assembly_vote_credits_user_month_idx" ON "assembly_vote_credits" USING btree ("user_id","month_key");--> statement-breakpoint
CREATE INDEX "assembly_votes_option_idx" ON "assembly_votes" USING btree ("option_id");