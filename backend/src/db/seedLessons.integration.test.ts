import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from './schema'
import type { Database } from './client'
import {
  findMiddleInsertions,
  insertLessonInMiddle,
  LESSON_SEEDS,
  upsertLessonSeed,
} from './seedLessons'

// Teste de integração (RC.4.1 e RC.4.6): só roda com TEST_DATABASE_URL apontando
// pra um banco DESCARTÁVEL. Reproduz o que acontece num banco já semeado quando
// as lições novas entram no meio das trilhas: ordem renumerada, `code` trocado
// (inclusive em cadeia, 1.3 vira 1.4 e assim por diante) sem perder a linha, e
// dispensa só pra quem já passou da posição.
const databaseUrl = process.env.TEST_DATABASE_URL
const JUROS_KEY = 'juros-selic-cdi-tr'
const RESERVA_KEY = 'reserva-emergencia'
const NEW_KEYS = new Set([JUROS_KEY, RESERVA_KEY])

describe.skipIf(!databaseUrl)('seed de lição no meio da trilha (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') })
  })

  afterAll(async () => {
    await pool.end()
  })

  it('renumera, troca o code sem perder a linha e dispensa só quem já passou', async () => {
    await db.delete(schema.userLessonCheckpoints)
    await db.delete(schema.userLessonProgress)
    await db.delete(schema.lessons)
    const database = db as unknown as Database

    // Estado de antes das duas inserções: sem as lições novas, ordem e `code`
    // antigos (o `code` de toda lição antiga era o próprio `stableKey`).
    const insertedBefore = (order: number) =>
      LESSON_SEEDS.filter((s) => NEW_KEYS.has(s.stableKey) && s.sortOrder < order).length
    const before = LESSON_SEEDS.filter((s) => !NEW_KEYS.has(s.stableKey)).map((s) => ({
      ...s,
      sortOrder: s.sortOrder - insertedBefore(s.sortOrder),
      code: s.stableKey,
    }))
    for (const seed of before) await upsertLessonSeed(database, seed)
    const idsBefore = new Map(
      (await db.select().from(schema.lessons)).map((l) => [l.stableKey, l.id]),
    )

    const suffix = Date.now().toString(36)
    const users = await db
      .insert(schema.users)
      .values(
        ['a', 'b', 'd', 'e'].map((n) => ({
          name: n,
          email: `${n}-${suffix}@t.dev`,
          username: `${n}${suffix}`,
        })),
      )
      .returning({ id: schema.users.id })
    const [userA, userB, userD, userE] = users
    const bySortOrder = (await db.select().from(schema.lessons)).sort(
      (x, y) => x.sortOrder - y.sortOrder,
    )
    const completed = (userId: string, count: number) =>
      bySortOrder.slice(0, count).map((l) => ({ userId, lessonId: l.id, completedAt: new Date() }))
    await db
      .insert(schema.userLessonProgress)
      .values([
        ...completed(userA!.id, 5),
        ...completed(userB!.id, 4),
        ...completed(userD!.id, 8),
        ...completed(userE!.id, 7),
      ])

    const toInsert = await findMiddleInsertions(database, LESSON_SEEDS)
    expect(toInsert.map((s) => s.stableKey)).toEqual([JUROS_KEY, RESERVA_KEY])
    for (const seed of toInsert) await insertLessonInMiddle(database, seed, LESSON_SEEDS)
    for (const seed of LESSON_SEEDS) await upsertLessonSeed(database, seed)

    const after = await db.select().from(schema.lessons)
    expect(after).toHaveLength(LESSON_SEEDS.length)
    for (const seed of LESSON_SEEDS) {
      const row = after.find((l) => l.stableKey === seed.stableKey)!
      expect({ code: row.code, sortOrder: row.sortOrder }, seed.stableKey).toEqual({
        code: seed.code,
        sortOrder: seed.sortOrder,
      })
      if (idsBefore.has(seed.stableKey))
        expect(row.id, seed.stableKey).toBe(idsBefore.get(seed.stableKey))
    }
    expect(after.find((l) => l.stableKey === '0.5')!.code).toBe('0.6')
    expect(after.find((l) => l.stableKey === '1.3')!.code).toBe('1.4')
    expect(after.find((l) => l.stableKey === '1.11')!.code).toBe('1.12')

    const waivedFor = async (key: string) => {
      const lessonId = after.find((l) => l.stableKey === key)!.id
      const rows = await db
        .select()
        .from(schema.userLessonProgress)
        .where(eq(schema.userLessonProgress.lessonId, lessonId))
      return rows
        .filter((r) => r.waivedAt !== null && r.completedAt === null)
        .map((r) => r.userId)
        .sort()
    }
    expect(await waivedFor(JUROS_KEY)).toEqual([userA!.id, userD!.id, userE!.id].sort())
    expect(await waivedFor(RESERVA_KEY)).toEqual([userD!.id])
    expect(userB).toBeDefined()

    // Idempotente: rodar de novo não insere nem dispensa de novo.
    expect(await findMiddleInsertions(database, LESSON_SEEDS)).toEqual([])
  })
})
