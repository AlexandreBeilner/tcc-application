CREATE TABLE "ranking_valuation_samples" (
	"computed_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "ranking_valuation_samples_computed_at_user_id_pk" PRIMARY KEY("computed_at","user_id")
);
--> statement-breakpoint
ALTER TABLE "ranking_valuation_samples" ADD CONSTRAINT "ranking_valuation_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranking_valuation_samples_user_idx" ON "ranking_valuation_samples" USING btree ("user_id");