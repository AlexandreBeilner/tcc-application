ALTER TYPE "public"."achievement_criteria_type" ADD VALUE 'assemblies_participated';--> statement-breakpoint
ALTER TABLE "assemblies" ADD COLUMN "result_announced_at" timestamp with time zone;