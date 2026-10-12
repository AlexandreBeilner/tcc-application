ALTER TABLE "funnel_events" DROP CONSTRAINT "funnel_events_source_chk";--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_source_chk" CHECK ("funnel_events"."source" IS NULL OR "funnel_events"."source" IN ('league', 'duel', 'cosmetics', 'retrospective', 'assembly', 'portfolio', 'menu', 'header', 'direct'));
