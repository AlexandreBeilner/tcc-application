import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessons, userLessonCheckpoints, userLessonProgress } from '../../../../db/schema'
import type {
  CompletionAttemptResult,
  LessonProgressRecord,
  LessonRepository,
  UpsertProgressInput,
} from '../../application/ports/lessonRepository'
import type { CheckpointRecord, LessonSummary } from '../../domain/lesson'
import { parseLessonBlocks } from '../content/lessonBlocks'

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
    microDecisionOptions: row.microDecisionOptions,
    microDecisionCorrectOption: row.microDecisionCorrectOption,
    // Fora do contrato vira `null`: o player cai no texto legado em vez de quebrar.
    blocks: parseLessonBlocks(row.blocks),
  }
}

function toProgressRecord(row: typeof userLessonProgress.$inferSelect): LessonProgressRecord {
  return {
    lessonId: row.lessonId,
    currentStep: row.currentStep,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
    lastReviewedAt: row.lastReviewedAt,
    microDecisionSelectedOption: row.microDecisionSelectedOption,
    microDecisionAttempts: row.microDecisionAttempts,
    microDecisionWrongOptions: row.microDecisionWrongOptions,
    microDecisionSolvedAt: row.microDecisionSolvedAt,
    waivedAt: row.waivedAt,
  }
}

function toCheckpointRecord(row: typeof userLessonCheckpoints.$inferSelect): CheckpointRecord {
  return {
    checkpointId: row.checkpointId,
    attempts: row.attempts,
    wrongOptions: row.wrongOptions,
    solvedAt: row.solvedAt,
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
      // `microDecisionSelectedOption` só entra no INSERT/UPDATE quando o
      // chamador passa o campo de verdade (`undefined` !== `null` aqui) —
      // ver o comentário em `UpsertProgressInput`.
      const selectedOption =
        input.microDecisionSelectedOption !== undefined
          ? { microDecisionSelectedOption: input.microDecisionSelectedOption }
          : {}
      const [row] = await db
        .insert(userLessonProgress)
        .values({
          userId,
          lessonId,
          currentStep: input.currentStep,
          completedAt: input.completedAt,
          ...selectedOption,
        })
        .onConflictDoUpdate({
          target: [userLessonProgress.userId, userLessonProgress.lessonId],
          set: {
            currentStep: input.currentStep,
            completedAt: input.completedAt,
            updatedAt: new Date(),
            ...selectedOption,
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
      microDecisionSelectedOption?: number,
    ): Promise<CompletionAttemptResult> {
      // Mesmo padrão condicional de `upsertProgress` acima — `undefined` não
      // sobrescreve a escolha já gravada num passo anterior.
      const selectedOption =
        microDecisionSelectedOption !== undefined ? { microDecisionSelectedOption } : {}
      // `setWhere` só deixa o UPDATE do conflito disparar se a linha ainda
      // estiver com `completedAt` nulo — o Postgres serializa duas
      // transações concorrentes que conflitam na mesma linha (lock de
      // linha), então só uma vê `completedAt IS NULL` e ganha o RETURNING;
      // a outra, ao ser liberada, já enxerga `completedAt` setado e o
      // predicado falha (nenhuma linha retornada). Mesmo padrão de
      // `drizzleMissionRepository.markCompleted`.
      const [claimed] = await db
        .insert(userLessonProgress)
        .values({ userId, lessonId, currentStep, completedAt, ...selectedOption })
        .onConflictDoUpdate({
          target: [userLessonProgress.userId, userLessonProgress.lessonId],
          set: { currentStep, completedAt, updatedAt: new Date(), ...selectedOption },
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

    async recordMicroDecisionAnswer(userId, lessonId, answer) {
      const t = userLessonProgress
      const [row] = await db
        .update(t)
        .set({
          microDecisionSelectedOption: sql`COALESCE(${t.microDecisionSelectedOption}, ${answer.selectedOption})`,
          microDecisionAttempts: sql`${t.microDecisionAttempts} + 1`,
          microDecisionWrongOptions: answer.correct
            ? sql`${t.microDecisionWrongOptions}`
            : sql`CASE WHEN ${answer.selectedOption} = ANY(${t.microDecisionWrongOptions}) THEN ${t.microDecisionWrongOptions} ELSE array_append(${t.microDecisionWrongOptions}, ${answer.selectedOption}::smallint) END`,
          microDecisionSolvedAt: answer.correct ? answer.answeredAt : null,
          // Preserva `updated_at` (intervalo mínimo entre passos, S.4).
          updatedAt: sql`${t.updatedAt}`,
        })
        .where(
          and(
            eq(t.userId, userId),
            eq(t.lessonId, lessonId),
            isNull(t.microDecisionSolvedAt),
            isNull(t.completedAt),
          ),
        )
        .returning()
      return row ? toProgressRecord(row) : undefined
    },

    async listCheckpointsForUser(userId, lessonId) {
      const rows = await db
        .select()
        .from(userLessonCheckpoints)
        .where(
          and(
            eq(userLessonCheckpoints.userId, userId),
            eq(userLessonCheckpoints.lessonId, lessonId),
          ),
        )
      return rows.map(toCheckpointRecord)
    },

    async recordCheckpointAnswer(userId, lessonId, checkpointId, answer) {
      const t = userLessonCheckpoints
      const initialWrong =
        answer.correct || answer.choice === null
          ? sql`'{}'::smallint[]`
          : sql`ARRAY[${answer.choice}]::smallint[]`
      const [row] = await db
        .insert(t)
        .values({
          userId,
          lessonId,
          checkpointId,
          attempts: 1,
          wrongOptions: initialWrong,
          solvedAt: answer.correct ? answer.answeredAt : null,
        })
        .onConflictDoUpdate({
          target: [t.userId, t.lessonId, t.checkpointId],
          set: {
            attempts: sql`${t.attempts} + 1`,
            wrongOptions:
              answer.correct || answer.choice === null
                ? sql`${t.wrongOptions}`
                : sql`CASE WHEN ${answer.choice} = ANY(${t.wrongOptions}) THEN ${t.wrongOptions} ELSE array_append(${t.wrongOptions}, ${answer.choice}::smallint) END`,
            solvedAt: answer.correct ? answer.answeredAt : null,
          },
          // Já resolvido: não escreve (a resposta vira leitura).
          setWhere: isNull(t.solvedAt),
        })
        .returning()
      if (row) {
        return toCheckpointRecord(row)
      }
      const [existing] = await db
        .select()
        .from(t)
        .where(
          and(eq(t.userId, userId), eq(t.lessonId, lessonId), eq(t.checkpointId, checkpointId)),
        )
        .limit(1)
      return toCheckpointRecord(existing)
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
