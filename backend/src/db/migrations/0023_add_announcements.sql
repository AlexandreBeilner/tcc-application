CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(80) NOT NULL,
	"body" varchar(280) NOT NULL,
	"severity" text NOT NULL,
	"kind" text DEFAULT 'notice' NOT NULL,
	"dismissible" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"linked_halt_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_severity_chk" CHECK ("announcements"."severity" IN ('info', 'warning', 'critical')),
	CONSTRAINT "announcements_kind_chk" CHECK ("announcements"."kind" IN ('notice', 'maintenance')),
	CONSTRAINT "announcements_window_chk" CHECK ("announcements"."ends_at" IS NULL OR "announcements"."ends_at" > "announcements"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_window_idx" ON "announcements" USING btree ("starts_at","ends_at");