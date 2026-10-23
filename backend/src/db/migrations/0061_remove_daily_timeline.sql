-- DI18: o Diário passa a ter dois cartões (Palavra do dia e Pergunta do dia); a Linha do tempo sai.
-- Jogos e resultados ficam: a palavra e a pergunta de cada jogo continuam valendo, então o arquivo e
-- os dias anteriores seguem jogáveis com dois cartões. Apagar os jogos deixaria os números passados
-- sem jogo para sempre (a agenda só monta de hoje em diante). Nada é recalculado: quem fechou com
-- três cartões fica com o XP que ganhou.
DROP TABLE "daily_events" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_puzzles" DROP CONSTRAINT "daily_puzzles_timeline_chk";--> statement-breakpoint
ALTER TABLE "daily_puzzles" DROP CONSTRAINT "daily_puzzles_origin_chk";--> statement-breakpoint
ALTER TABLE "daily_puzzles" DROP COLUMN "timeline_event_ids";--> statement-breakpoint
ALTER TABLE "daily_puzzles" DROP COLUMN "timeline_origin";--> statement-breakpoint
ALTER TABLE "daily_results" DROP COLUMN "timeline_order";--> statement-breakpoint
ALTER TABLE "daily_results" DROP COLUMN "timeline_correct";--> statement-breakpoint
-- Jogo com palavra e pergunta respondidas que esperava só a Linha do tempo: com dois cartões ele já
-- terminou. Fecha sem XP (quem concede XP é a resposta do último cartão, e ela não vai mais chegar).
UPDATE "daily_results" SET "completed_at" = now() WHERE "completed_at" IS NULL AND "word_correct" IS NOT NULL AND "question_correct" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_origin_chk" CHECK ("daily_puzzles"."word_origin" IN ('generated', 'manual') AND "daily_puzzles"."question_origin" IN ('generated', 'manual'));--> statement-breakpoint
-- "Cronologia em Dia" sai do catálogo; quem já ganhou continua com ela (N.19). O valor do enum
-- fica (o Postgres não remove valor de enum) e é comparado como texto: num banco novo todas as
-- migrações rodam numa transação só, e usar como enum um valor criado na mesma transação falha.
UPDATE "achievements" SET "is_active" = false WHERE "criteria_type"::text = 'daily_timeline_streak';--> statement-breakpoint
-- Os seeds só inserem o que falta, então o texto novo chega aos bancos existentes por aqui. Só
-- troca o texto original do seed: uma descrição editada no painel fica como está.
UPDATE "achievements" SET "description" = 'Acerte os dois cartões do Diário no mesmo dia.' WHERE "seed_key" = 'daily_perfect_day' AND "description" = 'Acerte os três cartões do Diário no mesmo dia.';--> statement-breakpoint
UPDATE "achievements" SET "description" = 'Acerte os dois cartões do Diário em 10 dias diferentes.' WHERE "seed_key" = 'daily_perfect_days_10' AND "description" = 'Acerte os três cartões do Diário em 10 dias diferentes.';--> statement-breakpoint
UPDATE "daily_missions" SET "description" = 'Termine os dois cartões do Diário Selucra de hoje.' WHERE "key" = 'play_daily' AND "description" = 'Termine os três cartões do Diário Selucra de hoje.';
