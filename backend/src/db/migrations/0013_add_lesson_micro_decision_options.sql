ALTER TABLE "lessons" ADD COLUMN "micro_decision_options" text[];--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "micro_decision_correct_option" smallint;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN "micro_decision_selected_option" smallint;