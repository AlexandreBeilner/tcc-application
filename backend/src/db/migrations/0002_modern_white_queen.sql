ALTER TABLE "user_progression" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_progression" ADD COLUMN "longest_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_progression" ADD COLUMN "last_qualifying_activity_date" date;