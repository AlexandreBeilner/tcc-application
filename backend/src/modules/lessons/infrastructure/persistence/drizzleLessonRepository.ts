import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessons, userLessonProgress } from '../../../../db/schema'
import type {
  CompletionAttemptResult,
  LessonProgressRecord,
  LessonRepository,
  UpsertProgressInput,
} from '../../application/ports/lessonRepository'
import type { LessonSummary } from '../../domain/lesson'

function toLessonSummary(row: typeof lessons.$inferSelect): LessonSummary {
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
  }
}

function toProgressRecord(row: typeof userLessonProgress.$inferSelect): LessonProgressRecord {
  return {
    lessonId: row.lessonId,
    currentStep: row.currentStep,
    completedAt: row.completedAt,
    lastReviewedAt: row.lastReviewedAt,
  }
}

export function createDrizzleLessonRepository(db: Database): LessonRepository {
  return {
    async listAll() {
      const rows = await db.select().from(lessons).orderBy(asc(lessons.sortOrder))
      return rows.map(toLessonSummary)
    },

    async findById(id) {
      const [row] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
      return row ? toLessonSummary(row) : undefined
    },

    async listProgressForUser(userId) {
      const rows = await db
        .select()
        .from(userLessonProgress)
        .where(eq(userLessonProgress.userId, userId))
      return rows.map(toProgressRecord)
    },

    async upsertProgress(userId: string, lessonId: string, input: UpsertProgressInput) {
      const [row] = await db
        .insert(userLessonProgress)
        .values({
          userId,
          lessonId,
          currentStep: input.currentStep,
          completedAt: input.completedAt,
        })
        .onConflictDoUpdate({
          target: [userLessonProgress.userId, userLessonProgress.lessonId],
          set: {
            currentStep: input.currentStep,
            completedAt: input.completedAt,
            updatedAt: new Date(),
          },
        })
        .returning()
      return toProgressRecord(row)
    },

    async completeIfNotAlreadyCompleted(
      userId: string,
      lessonId: string,
      currentStep: number,
      completedAt: Date,
    ): Promise<CompletionAttemptResult> {
      // `setWhere` só deixa o UPDATE do conflito disparar se a linha ainda
      // estiver com `completedAt` nulo — o Postgres serializa duas
      // transações concorrentes que conflitam na mesma linha (lock de
      // linha), então só uma vê `completedAt IS NULL` e ganha o RETURNING;
      // a outra, ao ser liberada, já enxerga `completedAt` setado e o
      // predicado falha (nenhuma linha retornada). Mesmo padrão de
      // `drizzleMissionRepository.markCompleted`.
      const [claimed] = await db
        .insert(userLessonProgress)
        .values({ userId, lessonId, currentStep, completedAt })
        .onConflictDoUpdate({
          target: [userLessonProgress.userId, userLessonProgress.lessonId],
          set: { currentStep, completedAt, updatedAt: new Date() },
          setWhere: isNull(userLessonProgress.completedAt),
        })
        .returning()

      if (claimed) {
        return { record: toProgressRecord(claimed), wonRace: true }
      }

      const [existing] = await db
        .select()
        .from(userLessonProgress)
        .where(
          and(eq(userLessonProgress.userId, userId), eq(userLessonProgress.lessonId, lessonId)),
        )
        .limit(1)
      return { record: toProgressRecord(existing), wonRace: false }
    },

    async markReviewed(userId: string, lessonId: string, reviewedAt: Date) {
      await db
        .update(userLessonProgress)
        .set({ lastReviewedAt: reviewedAt, updatedAt: reviewedAt })
        .where(
          and(eq(userLessonProgress.userId, userId), eq(userLessonProgress.lessonId, lessonId)),
        )
    },
  }
}
