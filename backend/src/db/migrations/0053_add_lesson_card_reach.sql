CREATE TABLE "lesson_card_reach" (
	"lesson_id" uuid NOT NULL,
	"phase" smallint NOT NULL,
	"card_index" smallint NOT NULL,
	"day" date NOT NULL,
	"reached_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lesson_card_reach_lesson_id_phase_card_index_day_pk" PRIMARY KEY("lesson_id","phase","card_index","day"),
	CONSTRAINT "lesson_card_reach_phase_chk" CHECK ("lesson_card_reach"."phase" BETWEEN 0 AND 3),
	CONSTRAINT "lesson_card_reach_card_chk" CHECK ("lesson_card_reach"."card_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_lesson_card_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"furthest_phase" smallint NOT NULL,
	"furthest_card" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lesson_card_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_card_reach" ADD CONSTRAINT "lesson_card_reach_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_card_progress" ADD CONSTRAINT "user_lesson_card_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lesson_card_progress" ADD CONSTRAINT "user_lesson_card_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;