-- Suspensão de conta e invalidação de sessão (N.16): todo usuário existente
-- nasce `active` com `token_version = 0`, então nada muda pra quem já está
-- logado. Reversível por DROP CONSTRAINT users_status_chk e DROP COLUMN das
-- quatro colunas.
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_chk" CHECK ("users"."status" IN ('active', 'suspended'));