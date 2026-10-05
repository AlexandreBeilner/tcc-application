import { asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessons } from '../../../../db/schema'
import type {
  CatalogRow,
  LessonCatalogRepository,
} from '../../application/ports/lessonCatalogRepository'
import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'

export function toCatalogLesson(row: typeof lessons.$inferSelect): CatalogLesson {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    trackNumber: row.trackNumber,
    trackName: row.trackName,
    sortOrder: row.sortOrder,
    centralConcept: row.centralConcept,
    scenarioText: row.scenarioText,
    microDecisionPrompt: row.microDecisionPrompt,
    microDecisionType: row.microDecisionType,
    microDecisionAssetTicker: row.microDecisionAssetTicker,
    revelationText: row.revelationText,
    unlocksDescription: row.unlocksDescription,
    unlocksKeys: row.unlocksKeys,
    unlocksAssetTicker: row.unlocksAssetTicker,
    microDecisionOptions: row.microDecisionOptions,
    microDecisionCorrectOption: row.microDecisionCorrectOption,
    published: row.published,
  }
}

interface FunnelRow extends Record<string, unknown> {
  lesson_id: string
  started: number
  completed: number
  avg_seconds: number | null
  median_seconds: number | null
  bet_answered: number
  bet_correct: number
  step0: number
  step1: number
  step2: number
  step3: number
}

// Linha de dispensa nunca aberta (N.24): passo 0, sem conclusão, com `waived_at`. Não é "iniciou".
const STARTED = sql`NOT (p.completed_at IS NULL AND p.waived_at IS NOT NULL AND p.current_step = 0)`

// Tempo de quem concluiu por conta própria: a linha dispensada tem `started_at` do dia da
// dispensa, não do dia em que o usuário abriu a lição, então fica de fora.
const COMPLETED_BY_USER = sql`p.completed_at IS NOT NULL AND p.waived_at IS NULL`
const DURATION = sql`EXTRACT(EPOCH FROM (p.completed_at - p.started_at))`

function emptyCounts(): LessonFunnelCounts {
  return {
    started: 0,
    completed: 0,
    avgSecondsToComplete: null,
    medianSecondsToComplete: null,
    betAnswered: 0,
    betCorrect: 0,
    abandonedByStep: [0, 0, 0, 0],
  }
}

export function createDrizzleLessonCatalogRepository(db: Database): LessonCatalogRepository {
  async function loadFunnels(): Promise<Map<string, LessonFunnelCounts>> {
    // Um agregado só sobre a tabela de progresso inteira, agrupado por lição: o custo cresce com
    // as linhas de progresso, não com lições x usuários.
    const result = await db.execute<FunnelRow>(sql`
      SELECT
        p.lesson_id,
        (COUNT(*) FILTER (WHERE ${STARTED}))::int AS started,
        (COUNT(*) FILTER (WHERE p.completed_at IS NOT NULL))::int AS completed,
        (AVG(${DURATION}) FILTER (WHERE ${COMPLETED_BY_USER}))::float8 AS avg_seconds,
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${DURATION}) FILTER (WHERE ${COMPLETED_BY_USER}))::float8 AS median_seconds,
        (COUNT(*) FILTER (
          WHERE l.micro_decision_correct_option IS NOT NULL
            AND p.completed_at IS NOT NULL
            AND p.micro_decision_selected_option IS NOT NULL
        ))::int AS bet_answered,
        (COUNT(*) FILTER (
          WHERE l.micro_decision_correct_option IS NOT NULL
            AND p.completed_at IS NOT NULL
            AND p.micro_decision_selected_option = l.micro_decision_correct_option
        ))::int AS bet_correct,
        (COUNT(*) FILTER (WHERE p.completed_at IS NULL AND ${STARTED} AND p.current_step <= 0))::int AS step0,
        (COUNT(*) FILTER (WHERE p.completed_at IS NULL AND ${STARTED} AND p.current_step = 1))::int AS step1,
        (COUNT(*) FILTER (WHERE p.completed_at IS NULL AND ${STARTED} AND p.current_step = 2))::int AS step2,
        (COUNT(*) FILTER (WHERE p.completed_at IS NULL AND ${STARTED} AND p.current_step >= 3))::int AS step3
      FROM user_lesson_progress p
      JOIN lessons l ON l.id = p.lesson_id
      GROUP BY p.lesson_id
    `)

    const byLesson = new Map<string, LessonFunnelCounts>()
    for (const row of result.rows) {
      byLesson.set(row.lesson_id, {
        started: row.started,
        completed: row.completed,
        avgSecondsToComplete: row.avg_seconds,
        medianSecondsToComplete: row.median_seconds,
        betAnswered: row.bet_answered,
        betCorrect: row.bet_correct,
        abandonedByStep: [row.step0, row.step1, row.step2, row.step3],
      })
    }
    return byLesson
  }

  return {
    async listWithFunnel(): Promise<CatalogRow[]> {
      const [rows, funnels] = await Promise.all([
        db.select().from(lessons).orderBy(asc(lessons.sortOrder)),
        loadFunnels(),
      ])
      return rows.map((row) => ({
        lesson: toCatalogLesson(row),
        funnel: funnels.get(row.id) ?? emptyCounts(),
      }))
    },

    async findById(id) {
      const [row] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
      return row ? toCatalogLesson(row) : undefined
    },

    async setPublished(id, published) {
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(lessons)
          .set({ published })
          .where(eq(lessons.id, id))
          .returning()
        if (!updated) {
          return undefined
        }
        const waivedUsers = published ? await waiveForPublishedLesson(tx, updated.id) : 0
        return { lesson: toCatalogLesson(updated), waivedUsers }
      })
    },
  }
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

// Dispensa quem já passou do ponto onde a lição entra na trilha (regra da N.24, espelho SQL de
// `shouldWaiveInsertedLesson`): usuário com pelo menos `posição` lições satisfeitas (concluídas ou
// dispensadas, só entre as publicadas) ainda não tem a lição e receberia o bloqueio dela. Quem já
// tem linha pra lição (concluiu antes de ela ser despublicada) fica como está. Deve rodar depois
// de a lição estar marcada como publicada, pra a posição contar ela mesma.
export async function waiveForPublishedLesson(tx: Tx, lessonId: string): Promise<number> {
  const result = await tx.execute(sql`
    INSERT INTO user_lesson_progress (user_id, lesson_id, current_step, waived_at)
    SELECT p.user_id, ${lessonId}::uuid, 0, now()
    FROM user_lesson_progress p
    JOIN lessons l ON l.id = p.lesson_id AND l.published
    WHERE p.completed_at IS NOT NULL OR p.waived_at IS NOT NULL
    GROUP BY p.user_id
    HAVING COUNT(*) >= (
      SELECT COUNT(*) FROM lessons pub
      WHERE pub.published AND pub.sort_order <= (SELECT sort_order FROM lessons WHERE id = ${lessonId}::uuid)
    )
    ON CONFLICT (user_id, lesson_id) DO NOTHING
  `)
  return result.rowCount ?? 0
}
