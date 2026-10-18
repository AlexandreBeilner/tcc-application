import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyQuestions } from '../../../../db/schema'
import type { DailyQuestionRepository } from '../../application/ports/dailyQuestionRepository'
import type { ContentScope, DailyQuestion } from '../../domain/content'
import { learnMoreColumns, toLearnMore } from './learnMore'

function toQuestion(row: typeof dailyQuestions.$inferSelect): DailyQuestion {
  return {
    id: row.id,
    stableKey: row.stableKey,
    question: row.question,
    options: row.options,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceRef: row.sourceRef,
    learnMore: toLearnMore(row.learnMoreKind, row.learnMoreRef),
    category: row.category,
    scope: row.scope as ContentScope,
    reviewedAt: row.reviewedAt,
    active: row.active,
  }
}

export function createDrizzleDailyQuestionRepository(db: Database): DailyQuestionRepository {
  return {
    async create(question) {
      const [row] = await db
        .insert(dailyQuestions)
        .values({
          stableKey: question.stableKey,
          question: question.question,
          options: question.options,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
          sourceRef: question.sourceRef,
          ...learnMoreColumns(question.learnMore),
          category: question.category,
          scope: question.scope,
          reviewedAt: question.reviewedAt,
          active: question.active,
        })
        .returning()
      return toQuestion(row)
    },

    async findById(id) {
      const [row] = await db.select().from(dailyQuestions).where(eq(dailyQuestions.id, id)).limit(1)
      return row ? toQuestion(row) : null
    },

    async findManyByIds(ids) {
      if (ids.length === 0) return []
      const rows = await db
        .select()
        .from(dailyQuestions)
        .where(inArray(dailyQuestions.id, [...ids]))
      return rows.map(toQuestion)
    },

    async listActive() {
      const rows = await db
        .select()
        .from(dailyQuestions)
        .where(eq(dailyQuestions.active, true))
        .orderBy(dailyQuestions.stableKey)
      return rows.map(toQuestion)
    },

    async listAll() {
      const rows = await db.select().from(dailyQuestions).orderBy(dailyQuestions.stableKey)
      return rows.map(toQuestion)
    },

    async update(id, fields, updatedBy) {
      const { learnMore, ...rest } = fields
      const [row] = await db
        .update(dailyQuestions)
        .set({
          ...rest,
          ...(learnMore !== undefined ? learnMoreColumns(learnMore) : {}),
          // Editar tira a revisão, a menos que o painel diga o contrário.
          ...(fields.reviewedAt === undefined ? { reviewedAt: null, reviewedBy: null } : {}),
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(dailyQuestions.id, id))
        .returning()
      return row ? toQuestion(row) : null
    },

    async markReviewed(ids, reviewedBy, now) {
      if (ids.length === 0) return
      await db
        .update(dailyQuestions)
        .set({ reviewedBy, reviewedAt: now })
        .where(inArray(dailyQuestions.id, [...ids]))
    },
  }
}
