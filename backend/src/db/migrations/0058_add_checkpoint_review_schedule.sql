ALTER TABLE "user_lesson_checkpoints" ADD COLUMN "review_stage" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_lesson_checkpoints" ADD COLUMN "review_due_at" timestamp with time zone;--> statement-breakpoint
-- Perguntas que a pessoa já resolveu depois de errar entram na fila de revisão (LJ.5.6): primeiro retorno 1 dia
-- depois do acerto. Mesmo critério de "errou" do app (`missedCheckpoint`): tentativa a mais nos formatos por
-- índice, par recusado em ligar, estimativa fora da tolerância.
UPDATE "user_lesson_checkpoints" SET "review_due_at" = "solved_at" + interval '1 day' WHERE "solved_at" IS NOT NULL AND (
  (("last_response" IS NULL OR "last_response"->>'kind' IN ('order', 'categorize')) AND "attempts" > 1)
  OR ("last_response"->>'kind' = 'match' AND ("last_response"->>'misses')::int > 0)
  OR ("last_response"->>'kind' = 'estimate' AND ("last_response"->>'hit')::boolean = false)
);
