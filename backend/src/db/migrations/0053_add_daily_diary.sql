CREATE TABLE "daily_accepted_words" (
	"word" varchar(9) PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "daily_accepted_words_word_chk" CHECK ("daily_accepted_words"."word" ~ '^[A-Z]{4,9}$'),
	CONSTRAINT "daily_accepted_words_source_chk" CHECK ("daily_accepted_words"."source" IN ('vero', 'extra'))
);
--> statement-breakpoint
CREATE TABLE "daily_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_key" varchar(80) NOT NULL,
	"year" smallint NOT NULL,
	"label" varchar(80) NOT NULL,
	"explanation" text NOT NULL,
	"source_ref" text NOT NULL,
	"learn_more_kind" text,
	"learn_more_ref" text,
	"category" varchar(40) NOT NULL,
	"scope" text NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_events_stable_key_unique" UNIQUE("stable_key"),
	CONSTRAINT "daily_events_year_chk" CHECK ("daily_events"."year" BETWEEN 1500 AND 2200),
	CONSTRAINT "daily_events_scope_chk" CHECK ("daily_events"."scope" IN ('brasil', 'fora')),
	CONSTRAINT "daily_events_source_chk" CHECK (length(btrim("daily_events"."source_ref")) > 0),
	CONSTRAINT "daily_events_learn_more_chk" CHECK (("daily_events"."learn_more_kind" IS NULL) = ("daily_events"."learn_more_ref" IS NULL) AND ("daily_events"."learn_more_kind" IS NULL OR "daily_events"."learn_more_kind" IN ('lesson', 'glossary', 'guide')))
);
--> statement-breakpoint
CREATE TABLE "daily_puzzles" (
	"number" integer PRIMARY KEY NOT NULL,
	"game_date" date NOT NULL,
	"word_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"timeline_event_ids" jsonb NOT NULL,
	"word_origin" text DEFAULT 'generated' NOT NULL,
	"question_origin" text DEFAULT 'generated' NOT NULL,
	"timeline_origin" text DEFAULT 'generated' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_puzzles_game_date_unique" UNIQUE("game_date"),
	CONSTRAINT "daily_puzzles_number_chk" CHECK ("daily_puzzles"."number" >= 1),
	CONSTRAINT "daily_puzzles_origin_chk" CHECK ("daily_puzzles"."word_origin" IN ('generated', 'manual') AND "daily_puzzles"."question_origin" IN ('generated', 'manual') AND "daily_puzzles"."timeline_origin" IN ('generated', 'manual')),
	CONSTRAINT "daily_puzzles_timeline_chk" CHECK (jsonb_typeof("daily_puzzles"."timeline_event_ids") = 'array' AND jsonb_array_length("daily_puzzles"."timeline_event_ids") = 4)
);
--> statement-breakpoint
CREATE TABLE "daily_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_key" varchar(80) NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" smallint NOT NULL,
	"explanation" text NOT NULL,
	"source_ref" text NOT NULL,
	"learn_more_kind" text,
	"learn_more_ref" text,
	"category" varchar(40) NOT NULL,
	"scope" text NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_questions_stable_key_unique" UNIQUE("stable_key"),
	CONSTRAINT "daily_questions_scope_chk" CHECK ("daily_questions"."scope" IN ('brasil', 'fora')),
	CONSTRAINT "daily_questions_source_chk" CHECK (length(btrim("daily_questions"."source_ref")) > 0),
	CONSTRAINT "daily_questions_options_chk" CHECK (jsonb_typeof("daily_questions"."options") = 'array' AND jsonb_array_length("daily_questions"."options") BETWEEN 2 AND 6 AND "daily_questions"."correct_index" >= 0 AND "daily_questions"."correct_index" < jsonb_array_length("daily_questions"."options")),
	CONSTRAINT "daily_questions_learn_more_chk" CHECK (("daily_questions"."learn_more_kind" IS NULL) = ("daily_questions"."learn_more_ref" IS NULL) AND ("daily_questions"."learn_more_kind" IS NULL OR "daily_questions"."learn_more_kind" IN ('lesson', 'glossary', 'guide')))
);
--> statement-breakpoint
CREATE TABLE "daily_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"puzzle_number" integer NOT NULL,
	"word_guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_correct" boolean,
	"question_choice" smallint,
	"question_correct" boolean,
	"timeline_order" jsonb,
	"timeline_correct" boolean,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "daily_results_user_puzzle_unique" UNIQUE("user_id","puzzle_number"),
	CONSTRAINT "daily_results_xp_chk" CHECK ("daily_results"."xp_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"start_date" date,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_settings_singleton_chk" CHECK ("daily_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "daily_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_key" varchar(80) NOT NULL,
	"answer" varchar(9) NOT NULL,
	"display" varchar(20) NOT NULL,
	"definition" text NOT NULL,
	"learn_more_kind" text,
	"learn_more_ref" text,
	"category" varchar(40) NOT NULL,
	"scope" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_words_stable_key_unique" UNIQUE("stable_key"),
	CONSTRAINT "daily_words_answer_unique" UNIQUE("answer"),
	CONSTRAINT "daily_words_answer_chk" CHECK ("daily_words"."answer" ~ '^[A-Z]{4,9}$'),
	CONSTRAINT "daily_words_scope_chk" CHECK ("daily_words"."scope" IN ('brasil', 'fora')),
	CONSTRAINT "daily_words_learn_more_chk" CHECK (("daily_words"."learn_more_kind" IS NULL) = ("daily_words"."learn_more_ref" IS NULL) AND ("daily_words"."learn_more_kind" IS NULL OR "daily_words"."learn_more_kind" IN ('lesson', 'glossary', 'guide')))
);
--> statement-breakpoint
ALTER TABLE "daily_events" ADD CONSTRAINT "daily_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_events" ADD CONSTRAINT "daily_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_word_id_daily_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."daily_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_question_id_daily_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."daily_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_questions" ADD CONSTRAINT "daily_questions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_questions" ADD CONSTRAINT "daily_questions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_results" ADD CONSTRAINT "daily_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_results" ADD CONSTRAINT "daily_results_puzzle_number_daily_puzzles_number_fk" FOREIGN KEY ("puzzle_number") REFERENCES "public"."daily_puzzles"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_settings" ADD CONSTRAINT "daily_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_words" ADD CONSTRAINT "daily_words_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_results_puzzle_idx" ON "daily_results" USING btree ("puzzle_number");--> statement-breakpoint
INSERT INTO "daily_settings" ("id") VALUES (1);
