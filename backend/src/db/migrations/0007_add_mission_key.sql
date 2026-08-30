ALTER TABLE "daily_missions" ADD COLUMN "key" varchar(50);
--> statement-breakpoint
UPDATE "daily_missions" SET "key" = 'lesson_complete' WHERE "title" = 'Complete uma lição da trilha' AND "key" IS NULL;
--> statement-breakpoint
UPDATE "daily_missions" SET "key" = 'calculator_compare' WHERE "title" = 'Compare dois produtos de renda fixa na calculadora' AND "key" IS NULL;
--> statement-breakpoint
UPDATE "daily_missions" SET "key" = 'feed_read' WHERE "title" = 'Consulte o feed de notícias' AND "key" IS NULL;
--> statement-breakpoint
ALTER TABLE "daily_missions" ALTER COLUMN "key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_missions" ADD CONSTRAINT "daily_missions_key_unique" UNIQUE("key");
