import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessonRevisions, lessons, users } from '../../../../db/schema'
import type {
  CatalogRow,
  LessonCatalogRepository,
  LessonRevision,
  LessonRevisionSummary,
  RevisionAction,
} from '../../application/ports/lessonCatalogRepository'
import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'
import { contentOf, type LessonContent } from '../../domain/lessonContent'

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

// Colunas de conteúdo de uma lição (as mesmas do `LessonContent`), pra INSERT e UPDATE.
function contentColumns(content: LessonContent) {
  return {
    title: content.title,
    centralConcept: content.centralConcept,
    scenarioText: content.scenarioText,
    microDecisionPrompt: content.microDecisionPrompt,
    microDecisionType: content.microDecisionType,
    microDecisionAssetTicker: content.microDecisionAssetTicker,
    microDecisionOptions: content.microDecisionOptions,
    microDecisionCorrectOption: content.microDecisionCorrectOption,
    revelationText: content.revelationText,
    unlocksDescription: content.unlocksDescription,
    unlocksKeys: content.unlocksKeys,
    unlocksAssetTicker: content.unlocksAssetTicker,
  }
}

// Serializa criação de lição e publicação (renumeração de `sort_order` e dispensa não podem
// intercalar). Lock de transação: solta sozinho no commit ou rollback.
const LESSON_ORDER_LOCK = 7231001

function toSummary(row: {
  id: string
  action: string
  adminId: string | null
  adminUsername: string | null
  createdAt: Date
}): LessonRevisionSummary {
  return {
    id: row.id,
    action: row.action as RevisionAction,
    adminId: row.adminId,
    adminUsername: row.adminUsername,
    createdAt: row.createdAt,
  }
}

// Próximo código livre da trilha ("N.k", com k acima de todos os segundos segmentos já usados nela).
// O `code` é só rótulo de posição didática (a ordem real é `sort_order`), então a lição nova pode
// ter um código que não segue a ordem; renumerar as outras é fora do escopo (identidade imutável).
async function nextCode(tx: Tx, trackNumber: number): Promise<string> {
  const rows = await tx.select({ code: lessons.code }).from(lessons)
  const used = new Set(rows.map((r) => r.code))
  let highest = 0
  for (const code of used) {
    const [track, second] = code.split('.')
    if (Number(track) === trackNumber && /^\d+$/.test(second ?? '')) {
      highest = Math.max(highest, Number(second))
    }
  }
  let candidate = highest + 1
  while (used.has(`${trackNumber}.${candidate}`)) candidate++
  return `${trackNumber}.${candidate}`
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

    async updateContent(id, content, actorId, action) {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(lessons).where(eq(lessons.id, id)).for('update')
        if (!current) {
          return undefined
        }
        const [existing] = await tx
          .select({ id: lessonRevisions.id })
          .from(lessonRevisions)
          .where(eq(lessonRevisions.lessonId, id))
          .limit(1)
        if (!existing) {
          // Lição vinda do seed, editada pela primeira vez: guarda o original antes de mudar, com
          // a data de criação da lição (distinta da edição, que vem a seguir na mesma transação).
          await tx.insert(lessonRevisions).values({
            lessonId: id,
            adminId: null,
            action: 'baseline',
            snapshot: contentOf(toCatalogLesson(current)) as unknown as Record<string, unknown>,
            createdAt: current.createdAt,
          })
        }
        const [updated] = await tx
          .update(lessons)
          .set(contentColumns(content))
          .where(eq(lessons.id, id))
          .returning()
        await tx.insert(lessonRevisions).values({
          lessonId: id,
          adminId: actorId,
          action,
          snapshot: content as unknown as Record<string, unknown>,
        })
        return toCatalogLesson(updated)
      })
    },

    async create(input, actorId) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${LESSON_ORDER_LOCK})`)

        const [anchor] = input.afterLessonId
          ? await tx.select().from(lessons).where(eq(lessons.id, input.afterLessonId))
          : await tx.select().from(lessons).orderBy(asc(lessons.sortOrder)).limit(1)
        if (!anchor) {
          return undefined
        }
        // Depois de `anchor`, na trilha dele; sem referência, antes de todas (posição da primeira).
        const sortOrder = input.afterLessonId ? anchor.sortOrder + 1 : anchor.sortOrder

        // `sort_order` é UNIQUE e a coluna única: desloca as seguintes em duas passadas (pelo
        // negativo), senão a primeira linha movida colidiria com a vizinha.
        await tx.execute(
          sql`UPDATE lessons SET sort_order = -(sort_order + 1) WHERE sort_order >= ${sortOrder}`,
        )
        await tx.execute(sql`UPDATE lessons SET sort_order = -sort_order WHERE sort_order < 0`)

        const code = await nextCode(tx, anchor.trackNumber)
        const [created] = await tx
          .insert(lessons)
          .values({
            // 'adm-' + 12 hex: não colide com as chaves do seed (que são o próprio código).
            stableKey: `adm-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
            code,
            trackNumber: anchor.trackNumber,
            trackName: anchor.trackName,
            sortOrder,
            published: true,
            ...contentColumns(input.content),
          })
          .returning()

        const waivedUsers = await waiveForPublishedLesson(tx, created.id)
        await tx.insert(lessonRevisions).values({
          lessonId: created.id,
          adminId: actorId,
          action: 'create',
          snapshot: input.content as unknown as Record<string, unknown>,
        })
        return { lesson: toCatalogLesson(created), waivedUsers }
      })
    },

    async listRevisions(lessonId) {
      const rows = await db
        .select({
          id: lessonRevisions.id,
          action: lessonRevisions.action,
          adminId: lessonRevisions.adminId,
          adminUsername: users.username,
          createdAt: lessonRevisions.createdAt,
        })
        .from(lessonRevisions)
        .leftJoin(users, eq(users.id, lessonRevisions.adminId))
        .where(eq(lessonRevisions.lessonId, lessonId))
        .orderBy(desc(lessonRevisions.createdAt))
      return rows.map(toSummary)
    },

    async findRevision(lessonId, revisionId): Promise<LessonRevision | undefined> {
      const [row] = await db
        .select({
          id: lessonRevisions.id,
          action: lessonRevisions.action,
          adminId: lessonRevisions.adminId,
          adminUsername: users.username,
          createdAt: lessonRevisions.createdAt,
          snapshot: lessonRevisions.snapshot,
        })
        .from(lessonRevisions)
        .leftJoin(users, eq(users.id, lessonRevisions.adminId))
        .where(and(eq(lessonRevisions.id, revisionId), eq(lessonRevisions.lessonId, lessonId)))
      return row
        ? { ...toSummary(row), content: row.snapshot as unknown as LessonContent }
        : undefined
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
