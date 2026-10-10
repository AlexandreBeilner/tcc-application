-- Respostas às perguntas intermediárias das lições (RC.3.2): aditivo.
CREATE TABLE "user_lesson_checkpoints" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"checkpoint_id" varchar(64) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"wrong_options" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"solved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lesson_checkpoints_user_id_lesson_id_checkpoint_id_pk" PRIMARY KEY("user_id","lesson_id","checkpoint_id")
);
--> statement-breakpoint
ALTER TABLE "user_lesson_checkpoints" ADD CONSTRAINT "user_lesson_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_checkpoints" ADD CONSTRAINT "user_lesson_checkpoints_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;
