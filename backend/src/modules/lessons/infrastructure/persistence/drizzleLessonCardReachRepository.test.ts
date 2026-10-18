import path from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleLessonCardReachRepository } from './drizzleLessonCardReachRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava lições/usuários). Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleLessonCardReachRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)
  let lessonId = ''
  const userIds: string[] = []

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })

    const [lesson] = await db
      .insert(schema.lessons)
      .values({
        stableKey: `r${suffix}`.slice(0, 20),
        code: `r${suffix}`.slice(0, 10),
        trackNumber: 99,
        trackName: 'Trilha de teste',
        sortOrder: 9_500_000 + (Date.now() % 100_000),
        title: 'Lição',
        centralConcept: 'conceito',
      })
      .returning({ id: schema.lessons.id })
    lessonId = (lesson as { id: string }).id

    const users = await db
      .insert(schema.users)
      .values(
        ['u1', 'u2', 'u3'].map((n) => ({
          name: n,
          email: `${n}-r${suffix}@t.dev`,
          username: `${n}r${suffix}`,
          passwordHash: 'h',
        })),
      )
      .returning({ id: schema.users.id, username: schema.users.username })
    userIds.push(...users.sort((a, b) => a.username.localeCompare(b.username)).map((u) => u.id))
  })

  // As tabelas novas têm FK pra `lessons` e `users`: sem limpar, os testes de integração dos outros
  // módulos (que apagam `users`/`lessons` na própria ordem) quebram no mesmo banco.
  afterAll(async () => {
    await db.delete(schema.lessonCardReach).where(eq(schema.lessonCardReach.lessonId, lessonId))
    await db
      .delete(schema.userLessonCardProgress)
      .where(eq(schema.userLessonCardProgress.lessonId, lessonId))
    await db.delete(schema.lessons).where(eq(schema.lessons.id, lessonId))
    await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    await pool.end()
  })

  const repo = () => createDrizzleLessonCardReachRepository(db)
  const at = (userId: string, phase: number, cardIndex: number, day = '2026-10-18') =>
    repo().recordReach({ userId, lessonId, position: { phase, cardIndex }, day })

  it('conta cada pessoa uma vez por cartão, só pra frente, e soma por cartão e dia', async () => {
    const [u1, u2, u3] = userIds as [string, string, string]

    expect(await at(u1, 0, 0)).toBe(true)
    expect(await at(u1, 0, 0)).toBe(false)
    expect(await at(u1, 0, 1)).toBe(true)
    // Voltar não conta de novo, nem o cartão por onde já passou.
    expect(await at(u1, 0, 0)).toBe(false)
    expect(await at(u1, 1, 0, '2026-10-19')).toBe(true)
    expect(await at(u2, 0, 0)).toBe(true)
    expect(await at(u3, 0, 0, '2026-10-17')).toBe(true)

    const all = await repo().listReach(lessonId, '2026-10-01')
    const byCard = Object.fromEntries(all.map((r) => [`${r.phase}:${r.cardIndex}`, r.reached]))
    expect(byCard).toEqual({ '0:0': 3, '0:1': 1, '1:0': 1 })

    const recent = await repo().listReach(lessonId, '2026-10-18')
    const recentByCard = Object.fromEntries(
      recent.map((r) => [`${r.phase}:${r.cardIndex}`, r.reached]),
    )
    expect(recentByCard).toEqual({ '0:0': 2, '0:1': 1, '1:0': 1 })
  })

  it('envios concorrentes da mesma pessoa contam uma vez só', async () => {
    const [u1] = userIds as [string]
    const results = await Promise.all(Array.from({ length: 8 }, () => at(u1, 2, 0, '2026-10-20')))

    expect(results.filter(Boolean)).toHaveLength(1)
    const rows = await repo().listReach(lessonId, '2026-10-20')
    expect(rows).toEqual([{ phase: 2, cardIndex: 0, reached: 1 }])
  })
})
