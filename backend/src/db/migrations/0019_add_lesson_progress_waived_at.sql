-- Dispensa de lição (N.24): coluna nullable, sem backfill — todo progresso
-- existente continua com `waived_at` nulo e a progressão se comporta como
-- antes. Reversível por `ALTER TABLE "user_lesson_progress" DROP COLUMN "waived_at"`.
ALTER TABLE "user_lesson_progress" ADD COLUMN "waived_at" timestamp with time zone;
