import path from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleLessonPollRepository } from './drizzleLessonPollRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava lições/usuários). Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleLessonPollRepository (banco real)', () => {
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
        stableKey: `p${suffix}`.slice(0, 20),
        code: `p${suffix}`.slice(0, 10),
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
          email: `${n}-p${suffix}@t.dev`,
          username: `${n}p${suffix}`,
          passwordHash: 'h',
        })),
      )
      .returning({ id: schema.users.id, username: schema.users.username })
    userIds.push(...users.sort((a, b) => a.username.localeCompare(b.username)).map((u) => u.id))
  })

  // As tabelas novas têm FK pra `lessons` e `users`: sem limpar, os testes de integração dos outros
  // módulos (que apagam `users`/`lessons` na própria ordem) quebram no mesmo banco.
  afterAll(async () => {
    await db.delete(schema.lessonPollVotes).where(eq(schema.lessonPollVotes.lessonId, lessonId))
    await db.delete(schema.lessons).where(eq(schema.lessons.id, lessonId))
    await db.delete(schema.users).where(inArray(schema.users.id, userIds))
    await pool.end()
  })

  const repo = () => createDrizzleLessonPollRepository(db)

  it('o primeiro voto vale e o reenvio devolve a opção gravada', async () => {
    const [u1] = userIds as [string]
    const input = { userId: u1, lessonId, pollId: 'e1' }

    expect(await repo().castVote({ ...input, option: 2 })).toBe(2)
    expect(await repo().castVote({ ...input, option: 0 })).toBe(2)
    expect(await repo().listVotesForUser(u1, lessonId)).toEqual([{ pollId: 'e1', option: 2 }])
  })

  it('votos concorrentes da mesma pessoa terminam com um voto só', async () => {
    const [, u2] = userIds as [string, string]
    const results = await Promise.all(
      [0, 1, 2, 3, 0, 1].map((option) =>
        repo().castVote({ userId: u2, lessonId, pollId: 'e2', option }),
      ),
    )

    expect(new Set(results).size).toBe(1)
    expect(await repo().tally(lessonId, 'e2')).toEqual([{ option: results[0], count: 1 }])
  })

  it('conta por opção e por enquete, sem identificar ninguém', async () => {
    const [u1, u2, u3] = userIds as [string, string, string]
    await repo().castVote({ userId: u3, lessonId, pollId: 'e3', option: 1 })
    await repo().castVote({ userId: u1, lessonId, pollId: 'e3', option: 1 })
    await repo().castVote({ userId: u2, lessonId, pollId: 'e3', option: 0 })

    const tally = await repo().tally(lessonId, 'e3')

    expect([...tally].sort((a, b) => a.option - b.option)).toEqual([
      { option: 0, count: 1 },
      { option: 1, count: 2 },
    ])
    expect(JSON.stringify(tally)).not.toContain(u1)
    expect(await repo().tally(lessonId, 'sem-votos')).toEqual([])
  })

  it('o banco recusa opção fora de 0 a 3', async () => {
    const [u1] = userIds as [string]
    await expect(
      repo().castVote({ userId: u1, lessonId, pollId: 'e4', option: 4 }),
    ).rejects.toThrow()
  })
})
