-- Catálogo de conquistas e missões operável pelo painel (N.19). Tudo que já existe
-- nasce ativo, então nada muda pra quem já joga. `seed_key` é preenchida pras 11
-- conquistas do seed, pra `db:seed:achievements` casar por ela e não duplicar uma
-- conquista renomeada no painel. Reversível por DROP CONSTRAINT
-- achievements_seed_key_unique e DROP COLUMN das três colunas.
ALTER TABLE "achievements" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "seed_key" varchar(50);--> statement-breakpoint
ALTER TABLE "daily_missions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_seed_key_unique" UNIQUE("seed_key");--> statement-breakpoint
UPDATE "achievements" SET "seed_key" = CASE "name"
  WHEN 'Primeira Semana' THEN 'streak_7'
  WHEN 'Fiel' THEN 'streak_30'
  WHEN 'Estudioso' THEN 'lessons_10'
  WHEN 'Formado na Trilha' THEN 'lessons_35'
  WHEN 'Primeiro Patrimônio' THEN 'net_worth_12k'
  WHEN 'Grande Investidor' THEN 'net_worth_25k'
  WHEN 'Primeira Operação' THEN 'trades_1'
  WHEN 'Trader Ativo' THEN 'trades_20'
  WHEN 'Olho Clínico' THEN 'micro_decisions_streak_5'
  WHEN 'Trilha Impecável' THEN 'track_completed_no_errors'
  WHEN 'Voltou pra Revisar' THEN 'lesson_reviewed'
END
WHERE "name" IN ('Primeira Semana', 'Fiel', 'Estudioso', 'Formado na Trilha', 'Primeiro Patrimônio', 'Grande Investidor', 'Primeira Operação', 'Trader Ativo', 'Olho Clínico', 'Trilha Impecável', 'Voltou pra Revisar');