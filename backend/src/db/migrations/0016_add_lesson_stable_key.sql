-- Ambiente não está em produção (tarefa M.6, achado 010 em
-- .claude/pontos-em-aberto-decisao-produto.md): sem dado real de usuário a
-- preservar. Trunca antes de tornar `stable_key` NOT NULL pra não precisar de
-- valor placeholder nem de uma política de migração de dado legado — um
-- `npm run db:seed:lessons` reseeda `lessons` do zero logo em seguida.
TRUNCATE TABLE "user_lesson_progress", "lessons" CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "stable_key" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_stable_key_unique" UNIQUE("stable_key");