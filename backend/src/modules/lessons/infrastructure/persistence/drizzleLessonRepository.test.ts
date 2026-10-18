import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleLessonRepository } from './drizzleLessonRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava lições/usuários). Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleLessonRepository.recordCheckpointAnswer (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)
  let lessonId = ''
  let userId = ''
  const answeredAt = new Date('2026-10-18T12:00:00Z')

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })

    const [lesson] = await db
      .insert(schema.lessons)
      .values({
        stableKey: `c${suffix}`.slice(0, 20),
        code: `c${suffix}`.slice(0, 10),
        trackNumber: 99,
        trackName: 'Trilha de teste',
        sortOrder: 9_600_000 + (Date.now() % 100_000),
        title: 'Lição',
        centralConcept: 'conceito',
      })
      .returning({ id: schema.lessons.id })
    lessonId = (lesson as { id: string }).id
    const [user] = await db
      .insert(schema.users)
      .values({
        name: 'u',
        email: `u-c${suffix}@t.dev`,
        username: `uc${suffix}`,
        passwordHash: 'h',
      })
      .returning({ id: schema.users.id })
    userId = (user as { id: string }).id
  })

  afterAll(async () => {
    await db
      .delete(schema.userLessonCheckpoints)
      .where(eq(schema.userLessonCheckpoints.lessonId, lessonId))
    await db.delete(schema.lessons).where(eq(schema.lessons.id, lessonId))
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await pool.end()
  })

  const repo = () => createDrizzleLessonRepository(db)

  it('estimativa errada resolve na 1ª resposta e guarda o chute; a 2ª não regrava', async () => {
    const first = await repo().recordCheckpointAnswer(userId, lessonId, 'e1', {
      choice: null,
      correct: false,
      solved: true,
      lastResponse: { kind: 'estimate', value: 3000, hit: false },
      answeredAt,
    })
    const second = await repo().recordCheckpointAnswer(userId, lessonId, 'e1', {
      choice: null,
      correct: true,
      solved: true,
      lastResponse: { kind: 'estimate', value: 6700, hit: true },
      answeredAt: new Date('2026-10-18T13:00:00Z'),
    })

    expect(first).toMatchObject({
      attempts: 1,
      wrongOptions: [],
      lastResponse: { kind: 'estimate', value: 3000, hit: false },
    })
    expect(first.solvedAt).toEqual(answeredAt)
    expect(second).toMatchObject({ attempts: 1, lastResponse: { value: 3000, hit: false } })
  })

  it('pergunta por índice segue igual: erro não resolve e não guarda resposta', async () => {
    const wrong = await repo().recordCheckpointAnswer(userId, lessonId, 'c1', {
      choice: 0,
      correct: false,
      answeredAt,
    })
    const right = await repo().recordCheckpointAnswer(userId, lessonId, 'c1', {
      choice: 1,
      correct: true,
      answeredAt,
    })

    expect(wrong).toMatchObject({
      attempts: 1,
      wrongOptions: [0],
      solvedAt: null,
      lastResponse: null,
    })
    expect(right).toMatchObject({ attempts: 2, wrongOptions: [0], lastResponse: null })
    expect(right.solvedAt).toEqual(answeredAt)
  })
  it('listAllCheckpointsForUser devolve as perguntas da pessoa de qualquer lição, com o id da lição', async () => {
    await repo().recordCheckpointAnswer(userId, lessonId, 'todas1', {
      choice: 1,
      correct: true,
      answeredAt,
    })

    const all = await repo().listAllCheckpointsForUser(userId)

    expect(all.map((c) => c.lessonId)).toEqual(expect.arrayContaining([lessonId]))
    expect(all.find((c) => c.checkpointId === 'todas1')).toMatchObject({ lessonId, attempts: 1 })
    expect(await repo().listAllCheckpointsForUser('00000000-0000-0000-0000-000000000000')).toEqual(
      [],
    )
  })
  it('fila de revisão: entra ao resolver com erro, lista só o vencido e reagenda uma vez por vencimento', async () => {
    const solved = new Date('2026-10-18T12:00:00Z')
    const due = new Date('2026-10-19T12:00:00Z')
    await repo().recordCheckpointAnswer(userId, lessonId, 'rev1', {
      choice: 0,
      correct: false,
      answeredAt: solved,
    })
    await repo().recordCheckpointAnswer(userId, lessonId, 'rev1', {
      choice: 1,
      correct: true,
      answeredAt: solved,
      reviewDueAt: due,
    })

    expect(
      await repo().listDueReviewsForUser(userId, new Date('2026-10-19T11:00:00Z'), 10),
    ).toEqual([])
    const listed = await repo().listDueReviewsForUser(userId, new Date('2026-10-19T13:00:00Z'), 10)
    expect(listed.map((c) => c.checkpointId)).toEqual(['rev1'])
    expect(listed[0]).toMatchObject({ lessonId, reviewStage: 0, reviewDueAt: due })

    const next = { stage: 1, dueAt: new Date('2026-10-22T13:00:00Z') }
    expect(await repo().scheduleReview(userId, lessonId, 'rev1', next, due)).toBe(true)
    // O mesmo vencimento não vale duas vezes.
    expect(await repo().scheduleReview(userId, lessonId, 'rev1', next, due)).toBe(false)
    expect(
      await repo().listDueReviewsForUser(userId, new Date('2026-10-19T13:00:00Z'), 10),
    ).toEqual([])

    expect(
      await repo().scheduleReview(userId, lessonId, 'rev1', { stage: 3, dueAt: null }, next.dueAt),
    ).toBe(true)
    const [row] = (await repo().listCheckpointsForUser(userId, lessonId)).filter(
      (c) => c.checkpointId === 'rev1',
    )
    expect(row).toMatchObject({ reviewStage: 3, reviewDueAt: null })
  })
  it('reagendar confere o vencimento mesmo quando o banco tem microssegundos', async () => {
    await repo().recordCheckpointAnswer(userId, lessonId, 'rev-us', {
      choice: 1,
      correct: true,
      answeredAt,
    })
    await db.execute(
      sql`update user_lesson_checkpoints set review_due_at = '2026-10-17 14:21:03.245236+00' where user_id = ${userId} and checkpoint_id = 'rev-us'`,
    )
    const [row] = await repo().listDueReviewsForUser(userId, new Date('2026-10-18T00:00:00Z'), 50)
    const target = (
      await repo().listDueReviewsForUser(userId, new Date('2026-10-18T00:00:00Z'), 50)
    ).find((c) => c.checkpointId === 'rev-us')
    expect(row).toBeDefined()

    expect(
      await repo().scheduleReview(
        userId,
        lessonId,
        'rev-us',
        { stage: 1, dueAt: new Date('2026-10-21T00:00:00Z') },
        target?.reviewDueAt as Date,
      ),
    ).toBe(true)
  })
})
