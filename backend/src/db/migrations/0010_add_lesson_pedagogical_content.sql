CREATE TYPE "public"."lesson_micro_decision_type" AS ENUM('reflection', 'growth_calculator', 'fixed_income_comparison', 'live_indicator');--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "scenario_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "micro_decision_prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "micro_decision_type" "lesson_micro_decision_type" DEFAULT 'reflection' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "micro_decision_asset_ticker" varchar(20);--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "revelation_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "unlocks_asset_ticker" varchar(20);