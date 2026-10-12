CREATE TABLE "assembly_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"kind" text,
	"subject_ref" text,
	"scope_key" varchar(200) NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	CONSTRAINT "assembly_pauses_scope_chk" CHECK ("assembly_pauses"."scope" IN ('global', 'subject'))
);
--> statement-breakpoint
CREATE TABLE "assembly_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assemblies" ADD COLUMN "min_voters" integer;--> statement-breakpoint
ALTER TABLE "assembly_pauses" ADD CONSTRAINT "assembly_pauses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_pauses" ADD CONSTRAINT "assembly_pauses_lifted_by_users_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_settings" ADD CONSTRAINT "assembly_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assembly_pauses_active_unique" ON "assembly_pauses" USING btree ("scope_key") WHERE lifted_at IS NULL;--> statement-breakpoint
CREATE INDEX "assembly_pauses_created_idx" ON "assembly_pauses" USING btree ("created_at");