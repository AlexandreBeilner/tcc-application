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

// Teste de integração (RC.4.1): só roda com TEST_DATABASE_URL apontando pra um
// banco DESCARTÁVEL. Reproduz o que acontece num banco já semeado quando a
// lição nova entra no meio da Trilha 0: ordem renumerada, `code` da poupança
// trocado sem perder a linha, e dispensa só pra quem já passou da posição.
const databaseUrl = process.env.TEST_DATABASE_URL
const NEW_KEY = 'juros-selic-cdi-tr'

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
    const newSeed = LESSON_SEEDS.find((s) => s.stableKey === NEW_KEY)!

    // Estado de antes da RC.4.1: sem a lição nova, ordem e code antigos.
    const before = LESSON_SEEDS.filter((s) => s.stableKey !== NEW_KEY).map((s) => ({
      ...s,
      sortOrder: s.sortOrder > newSeed.sortOrder ? s.sortOrder - 1 : s.sortOrder,
      code: s.stableKey === '0.5' ? '0.5' : s.code,
    }))
    for (const seed of before) await upsertLessonSeed(database, seed)
    const poupancaBefore = (
      await db.select().from(schema.lessons).where(eq(schema.lessons.stableKey, '0.5'))
    )[0]!

    const suffix = Date.now().toString(36)
    const [userA, userB, userC] = await db
      .insert(schema.users)
      .values(
        ['a', 'b', 'c'].map((n) => ({
          name: n,
          email: `${n}-${suffix}@t.dev`,
          username: `${n}${suffix}`,
        })),
      )
      .returning({ id: schema.users.id })
    const bySortOrder = (await db.select().from(schema.lessons)).sort(
      (x, y) => x.sortOrder - y.sortOrder,
    )
    const completed = (userId: string, count: number) =>
      bySortOrder.slice(0, count).map((l) => ({ userId, lessonId: l.id, completedAt: new Date() }))
    await db
      .insert(schema.userLessonProgress)
      .values([...completed(userA!.id, 5), ...completed(userB!.id, 4)])

    const toInsert = await findMiddleInsertions(database, LESSON_SEEDS)
    expect(toInsert.map((s) => s.stableKey)).toEqual([NEW_KEY])
    const result = await insertLessonInMiddle(database, toInsert[0]!)
    for (const seed of LESSON_SEEDS) await upsertLessonSeed(database, seed)

    expect(result.waivedUsers).toBe(1)
    const after = await db.select().from(schema.lessons)
    expect(after).toHaveLength(LESSON_SEEDS.length)
    for (const seed of LESSON_SEEDS) {
      const row = after.find((l) => l.stableKey === seed.stableKey)!
      expect({ code: row.code, sortOrder: row.sortOrder }, seed.stableKey).toEqual({
        code: seed.code,
        sortOrder: seed.sortOrder,
      })
    }
    const poupancaAfter = after.find((l) => l.stableKey === '0.5')!
    expect(poupancaAfter.id).toBe(poupancaBefore.id)
    expect(poupancaAfter.code).toBe('0.6')

    const newLesson = after.find((l) => l.stableKey === NEW_KEY)!
    const waivers = await db
      .select()
      .from(schema.userLessonProgress)
      .where(eq(schema.userLessonProgress.lessonId, newLesson.id))
    expect(waivers.map((w) => w.userId)).toEqual([userA!.id])
    expect(waivers[0]!.waivedAt).not.toBeNull()
    expect(waivers[0]!.completedAt).toBeNull()
    expect(userC).toBeDefined()

    // Idempotente: rodar de novo não insere nem dispensa de novo.
    expect(await findMiddleInsertions(database, LESSON_SEEDS)).toEqual([])
  })
})
