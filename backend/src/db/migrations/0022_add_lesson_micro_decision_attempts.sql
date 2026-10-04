ALTER TABLE "user_lesson_progress" ADD COLUMN "micro_decision_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN "micro_decision_wrong_options" smallint[] DEFAULT '{}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_progress" ADD COLUMN "micro_decision_solved_at" timestamp with time zone;--> statement-breakpoint
-- Backfill (RC.2.3): quem já escolheu uma opção e já passou da Micro-decisão (ou concluiu a lição) conta como
-- tendo resolvido a pergunta na única escolha que existia; o gate do passo 1 pro 2 não os afeta.
UPDATE "user_lesson_progress"
SET "micro_decision_attempts" = 1,
    "micro_decision_solved_at" = COALESCE("completed_at", "updated_at")
WHERE "micro_decision_selected_option" IS NOT NULL
  AND ("current_step" >= 2 OR "completed_at" IS NOT NULL);
