CREATE TABLE "daily_presence" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "daily_presence_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone" varchar(40) NOT NULL,
	"reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_milestones_user_milestone_unique" UNIQUE("user_id","milestone")
);
--> statement-breakpoint
ALTER TABLE "daily_presence" ADD CONSTRAINT "daily_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_presence_day_idx" ON "daily_presence" USING btree ("day");