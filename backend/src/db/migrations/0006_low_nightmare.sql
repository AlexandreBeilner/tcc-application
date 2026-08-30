CREATE TABLE "news_event_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"macro_event_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_event_reads_unique" UNIQUE("user_id","macro_event_id")
);
--> statement-breakpoint
ALTER TABLE "news_event_reads" ADD CONSTRAINT "news_event_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;