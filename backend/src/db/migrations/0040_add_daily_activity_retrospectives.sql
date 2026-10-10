CREATE TABLE "daily_activity" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "daily_activity_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "retrospectives" (
	"user_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retrospectives_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrospectives" ADD CONSTRAINT "retrospectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Melhor esforço: dias em que a pessoa concluiu lição (o que já existe). Missões e dias sem lição
-- não têm registro anterior, então o calendário só fica completo daqui para frente.
INSERT INTO "daily_activity" ("user_id", "day")
SELECT DISTINCT "user_id", ("completed_at" AT TIME ZONE 'UTC')::date
FROM "user_lesson_progress"
WHERE "completed_at" IS NOT NULL
ON CONFLICT DO NOTHING;
