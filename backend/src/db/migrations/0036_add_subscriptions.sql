CREATE TABLE "billing_webhook_events" (
	"id" varchar(200) PRIMARY KEY NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"store" text NOT NULL,
	"product_id" varchar(200) NOT NULL,
	"period" text DEFAULT 'unknown' NOT NULL,
	"purchased_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"grace_expires_at" timestamp with time zone,
	"billing_issue_detected_at" timestamp with time zone,
	"unsubscribe_detected_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"is_sandbox" boolean DEFAULT false NOT NULL,
	"management_url" text,
	"last_event_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_store_chk" CHECK ("subscriptions"."store" IN ('app_store', 'play_store', 'stripe', 'rc_billing', 'promotional', 'other')),
	CONSTRAINT "subscriptions_period_chk" CHECK ("subscriptions"."period" IN ('monthly', 'annual', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;