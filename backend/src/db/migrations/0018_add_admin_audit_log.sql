CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" text NOT NULL,
	"error_message" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_log_result_chk" CHECK ("admin_audit_log"."result" IN ('success', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_occurred_at_idx" ON "admin_audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_id_idx" ON "admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE FUNCTION admin_audit_log_reject_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'admin_audit_log é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON "admin_audit_log"
FOR EACH ROW EXECUTE FUNCTION admin_audit_log_reject_mutation();
