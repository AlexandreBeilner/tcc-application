ALTER TABLE "achievements" ADD COLUMN "is_rare" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Ponto de partida editável no painel (ponto 044, 2026-10-11): as conquistas difíceis do seed.
UPDATE "achievements" SET "is_rare" = true WHERE "seed_key" IN ('streak_30', 'lessons_35', 'net_worth_25k', 'track_completed_no_errors');
