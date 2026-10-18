CREATE TABLE "daily_metrics" (
	"metric_date" date NOT NULL,
	"metric" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_metrics_metric_date_metric_pk" PRIMARY KEY("metric_date","metric"),
	CONSTRAINT "daily_metrics_metric_chk" CHECK ("daily_metrics"."metric" IN ('anon_started', 'anon_completed', 'origin_signup', 'origin_login')),
	CONSTRAINT "daily_metrics_count_chk" CHECK ("daily_metrics"."count" >= 0)
);
