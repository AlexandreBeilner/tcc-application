ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;
--> statement-breakpoint
-- Admin nasce verificado pelo seed e não redefine senha por e-mail (D7): sem isto, um admin já
-- existente ficaria sem caminho de volta. Os demais usuários não recebem backfill (plano 8, EM.3.1).
UPDATE "users" SET "email_verified_at" = now() WHERE "role" = 'admin';
