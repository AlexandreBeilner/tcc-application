CREATE TABLE "agenda_proposal_supports" (
	"proposal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_proposal_supports_proposal_id_user_id_pk" PRIMARY KEY("proposal_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agenda_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_ref" text NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"proposed_by" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_assembly_id" uuid
);
--> statement-breakpoint
ALTER TABLE "agenda_proposal_supports" ADD CONSTRAINT "agenda_proposal_supports_proposal_id_agenda_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."agenda_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_proposal_supports" ADD CONSTRAINT "agenda_proposal_supports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_proposals" ADD CONSTRAINT "agenda_proposals_template_key_agenda_templates_key_fk" FOREIGN KEY ("template_key") REFERENCES "public"."agenda_templates"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_proposals" ADD CONSTRAINT "agenda_proposals_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_proposals" ADD CONSTRAINT "agenda_proposals_consumed_assembly_id_assemblies_id_fk" FOREIGN KEY ("consumed_assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agenda_proposals_active_unique" ON "agenda_proposals" USING btree ("kind","subject_ref","template_key") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "agenda_proposals_subject_idx" ON "agenda_proposals" USING btree ("kind","subject_ref","status");--> statement-breakpoint
CREATE INDEX "agenda_proposals_proposer_idx" ON "agenda_proposals" USING btree ("proposed_by","created_at");