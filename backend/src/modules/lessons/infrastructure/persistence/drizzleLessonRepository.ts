import { asc, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessons, userLessonProgress } from '../../../../db/schema'
import type {
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
    unlocksDescription: row.unlocksDescription,
    unlocksKeys: row.unlocksKeys,
  }
}

function toProgressRecord(row: typeof userLessonProgress.$inferSelect): LessonProgressRecord {
  return { lessonId: row.lessonId, currentStep: row.currentStep, completedAt: row.completedAt }
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
  }
}
