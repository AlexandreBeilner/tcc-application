import path from 'node:path'
import { eq } from 'drizzle-orm'
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
})
