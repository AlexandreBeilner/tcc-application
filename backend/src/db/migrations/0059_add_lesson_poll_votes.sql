CREATE TABLE "lesson_poll_votes" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"poll_id" text NOT NULL,
	"option" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_poll_votes_user_id_lesson_id_poll_id_pk" PRIMARY KEY("user_id","lesson_id","poll_id"),
	CONSTRAINT "lesson_poll_votes_option_chk" CHECK ("lesson_poll_votes"."option" BETWEEN 0 AND 3)
);
--> statement-breakpoint
ALTER TABLE "lesson_poll_votes" ADD CONSTRAINT "lesson_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_poll_votes" ADD CONSTRAINT "lesson_poll_votes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_poll_votes_poll_idx" ON "lesson_poll_votes" USING btree ("lesson_id","poll_id");
