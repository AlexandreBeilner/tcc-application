CREATE TABLE "payroll_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_paid_month" varchar(7) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_state" ADD CONSTRAINT "payroll_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;