-- O plano PRO saiu do produto (decisão do autor, 2026-10-24): tudo o que era pago fica livre para
-- todos. Saem a projeção da assinatura e o log do webhook (módulo `billing`), o funil de conversão,
-- o crédito mensal de voto das assembleias e a escada de semanas de PRO da indicação. Ligas,
-- duelos, cosméticos, retrospectivas e indicações continuam com os dados como estavam.
DELETE FROM "assembly_settings" WHERE "key" IN ('monthly_free_credits', 'free_credit_min_level');--> statement-breakpoint
DROP TABLE "assembly_vote_credits" CASCADE;--> statement-breakpoint
DROP TABLE "billing_webhook_events" CASCADE;--> statement-breakpoint
DROP TABLE "funnel_events" CASCADE;--> statement-breakpoint
DROP TABLE "referral_milestones" CASCADE;--> statement-breakpoint
DROP TABLE "referral_rewards" CASCADE;--> statement-breakpoint
DROP TABLE "subscriptions" CASCADE;
