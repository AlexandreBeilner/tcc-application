CREATE TYPE "public"."achievement_criteria_type" AS ENUM('net_worth', 'streak_days', 'lessons_completed', 'trades_executed');--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "criteria_type" "achievement_criteria_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "criteria_value" numeric(15, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" DROP COLUMN "required_points";
