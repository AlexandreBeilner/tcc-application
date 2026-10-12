import { lt, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { funnelEvents } from '../../../../db/schema'
import type { FunnelReader } from '../../application/ports/funnelReader'
import type { FunnelRetention } from '../../application/ports/funnelRetention'
import type { FunnelRecorder } from '../../application/ports/funnelRecorder'
import { FUNNEL_SOURCES } from '../../domain/funnel'
import type { FunnelSource, FunnelSummary, SourceFunnel } from '../../domain/funnel'

export function createDrizzleFunnelRecorder(db: Database): FunnelRecorder {
  return {
    async record(event) {
      await db
        .insert(funnelEvents)
        .values({
          userId: event.userId,
          name: event.name,
          source: event.source,
          plan: event.plan,
          dedupeKey: event.dedupeKey,
          createdAt: event.at,
        })
        .onConflictDoNothing({ target: funnelEvents.dedupeKey })
    },
  }
}

export function createDrizzleFunnelRetention(db: Database): FunnelRetention {
  return {
    async purgeOlderThan(cutoff) {
      const removed = await db
        .delete(funnelEvents)
        .where(lt(funnelEvents.createdAt, cutoff))
        .returning({ id: funnelEvents.id })
      return removed.length
    },
  }
}

interface StepRow extends Record<string, unknown> {
  invite_viewed: number
  plans_opened: number
  purchase_started: number
  subscribed: number
  cancelled: number
  lesson_completed: number
}

interface SourceRow extends Record<string, unknown> {
  source: string
  reached: number
  invite_viewed: number
  plans_opened: number
  purchase_started: number
  subscribed: number
}

function isSource(value: string): value is FunnelSource {
  return (FUNNEL_SOURCES as readonly string[]).includes(value)
}

export function createDrizzleFunnelReader(db: Database): FunnelReader {
  return {
    async summarize(since): Promise<FunnelSummary> {
      // Pessoas distintas por passo na janela. "Lição concluída" não é evento nosso: vem do
      // progresso que já existe, pra o topo do funil não depender de instrumentar a lição.
      const steps = await db.execute<StepRow>(sql`
        SELECT
          (COUNT(DISTINCT user_id) FILTER (WHERE name = 'invite_viewed'))::int AS invite_viewed,
          (COUNT(DISTINCT user_id) FILTER (WHERE name = 'plans_opened'))::int AS plans_opened,
          (COUNT(DISTINCT user_id) FILTER (WHERE name = 'purchase_started'))::int AS purchase_started,
          (COUNT(DISTINCT user_id) FILTER (WHERE name = 'subscribed'))::int AS subscribed,
          (COUNT(DISTINCT user_id) FILTER (WHERE name = 'cancelled'))::int AS cancelled,
          (SELECT COUNT(DISTINCT user_id)::int FROM user_lesson_progress
             WHERE completed_at >= ${since}) AS lesson_completed
        FROM funnel_events
        WHERE created_at >= ${since}
      `)

      // Por ponto de convite. "Assinou" = teve contato com o ponto e assinou depois, na janela.
      const bySource = await db.execute<SourceRow>(sql`
        SELECT
          e.source,
          (COUNT(DISTINCT e.user_id))::int AS reached,
          (COUNT(DISTINCT e.user_id) FILTER (WHERE e.name = 'invite_viewed'))::int AS invite_viewed,
          (COUNT(DISTINCT e.user_id) FILTER (WHERE e.name = 'plans_opened'))::int AS plans_opened,
          (COUNT(DISTINCT e.user_id) FILTER (WHERE e.name = 'purchase_started'))::int AS purchase_started,
          (COUNT(DISTINCT e.user_id) FILTER (WHERE EXISTS (
            SELECT 1 FROM funnel_events s
            WHERE s.user_id = e.user_id AND s.name = 'subscribed'
              AND s.created_at >= e.created_at AND s.created_at >= ${since}
          )))::int AS subscribed
        FROM funnel_events e
        WHERE e.created_at >= ${since} AND e.source IS NOT NULL
        GROUP BY e.source
      `)

      const row = steps.rows[0]
      const found = new Map<FunnelSource, SourceFunnel>()
      for (const r of bySource.rows) {
        if (!isSource(r.source)) continue
        found.set(r.source, {
          source: r.source,
          reached: r.reached,
          inviteViewed: r.invite_viewed,
          plansOpened: r.plans_opened,
          purchaseStarted: r.purchase_started,
          subscribed: r.subscribed,
        })
      }
      return {
        steps: {
          lessonCompleted: row?.lesson_completed ?? 0,
          inviteViewed: row?.invite_viewed ?? 0,
          plansOpened: row?.plans_opened ?? 0,
          purchaseStarted: row?.purchase_started ?? 0,
          subscribed: row?.subscribed ?? 0,
          cancelled: row?.cancelled ?? 0,
        },
        // Sempre todos os pontos, na mesma ordem, mesmo sem nenhum evento.
        bySource: FUNNEL_SOURCES.map(
          (source) =>
            found.get(source) ?? {
              source,
              reached: 0,
              inviteViewed: 0,
              plansOpened: 0,
              purchaseStarted: 0,
              subscribed: 0,
            },
        ),
      }
    },
  }
}
