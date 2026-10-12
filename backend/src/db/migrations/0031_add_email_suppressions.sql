CREATE TABLE "email_suppressions" (
	"address" varchar(320) PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppressions_reason_chk" CHECK ("email_suppressions"."reason" IN ('bounce', 'complaint', 'unsubscribe_all'))
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "delivered_at" timestamp with time zone;