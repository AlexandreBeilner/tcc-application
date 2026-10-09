CREATE TABLE "lesson_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"admin_id" uuid,
	"action" varchar(20) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_revisions_action_chk" CHECK ("lesson_revisions"."action" IN ('baseline', 'create', 'update', 'restore'))
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_revisions_lesson_id_idx" ON "lesson_revisions" USING btree ("lesson_id","created_at");
--> statement-breakpoint
CREATE FUNCTION lesson_revisions_immutable() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'lesson_revisions é append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER lesson_revisions_no_update_delete
	BEFORE UPDATE OR DELETE ON "lesson_revisions"
	FOR EACH ROW EXECUTE FUNCTION lesson_revisions_immutable();
