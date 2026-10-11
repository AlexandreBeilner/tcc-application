ALTER TYPE "public"."achievement_criteria_type" ADD VALUE 'referrals_qualified';--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_milestones" (
	"threshold" integer PRIMARY KEY NOT NULL,
	"reward_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"referrer_id" uuid NOT NULL,
	"threshold" integer NOT NULL,
	"reward_days" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"promo_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_at" timestamp with time zone,
	CONSTRAINT "referral_rewards_referrer_id_threshold_pk" PRIMARY KEY("referrer_id","threshold"),
	CONSTRAINT "referral_rewards_status_chk" CHECK ("referral_rewards"."status" IN ('pending', 'granted'))
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone,
	CONSTRAINT "referrals_referred_id_unique" UNIQUE("referred_id"),
	CONSTRAINT "referrals_status_chk" CHECK ("referrals"."status" IN ('pending', 'qualified')),
	CONSTRAINT "referrals_not_self_chk" CHECK ("referrals"."referrer_id" <> "referrals"."referred_id")
);
--> statement-breakpoint
ALTER TABLE "cosmetic_items" ADD COLUMN "unlock_referrals" integer;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_referrer_status_idx" ON "referrals" USING btree ("referrer_id","status");--> statement-breakpoint
INSERT INTO "referral_milestones" ("threshold", "reward_days") VALUES (5, 7), (20, 7), (50, 7);--> statement-breakpoint
INSERT INTO "cosmetic_items" ("key", "kind", "name", "description", "sort_order", "unlock_referrals") VALUES
  ('title_mensageiro', 'title', 'Mensageiro', 'Trouxe 5 amigos que começaram a aprender.', 90, 5),
  ('title_embaixador', 'title', 'Embaixador', 'Trouxe 20 amigos que começaram a aprender.', 91, 20),
  ('title_patrono', 'title', 'Patrono', 'Trouxe 50 amigos que começaram a aprender.', 92, 50);
