ALTER TABLE "agenda_templates" ADD COLUMN "purpose" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "assemblies" ADD COLUMN "declaration_id" uuid;--> statement-breakpoint
ALTER TABLE "agenda_templates" ADD CONSTRAINT "agenda_templates_purpose_chk" CHECK ("agenda_templates"."purpose" IN ('general', 'profit'));