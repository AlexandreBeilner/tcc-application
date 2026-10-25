import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { deleteAllUsers } from '../../../../db/test/deleteAllUsers'
import { monthRange, type RetrospectiveData } from '../../domain/retrospective'
import { createDrizzleMonthActivityReader } from './drizzleMonthActivityReader'
import { createDrizzleRetrospectiveRepository } from './drizzleRetrospectiveRepository'

// Integração (MO.5.4): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// várias tabelas de usuário). Prova as consultas reais do mês e o arquivo idempotente.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('retrospectivas (banco real)', () => {
  let pool: Pool
  let db: Database
  let ana: string
  let bia: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    for (const table of [
      schema.retrospectives,
      schema.dailyActivity,
      schema.duels,
      schema.leagueMembers,
      schema.leagues,
      schema.userAchievements,
      schema.userLessonProgress,
      schema.userProgression,
      schema.userCosmetics,
      schema.emailOutbox,
      schema.emailPreferences,
    ]) {
      await db.delete(table)
    }
    await deleteAllUsers(db)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'bia'].map((u) => ({
          name: u,
          username: u,
          email: `${u}@x.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    ana = rows[0].id
    bia = rows[1].id
  })

  afterAll(async () => {
    await pool.end()
  })

  const range = monthRange('2026-09')

  it('conta dias, duelos e ligas só do mês pedido', async () => {
    await db.insert(schema.dailyActivity).values([
      { userId: ana, day: '2026-08-31' },
      { userId: ana, day: '2026-09-01' },
      { userId: ana, day: '2026-09-02' },
      { userId: ana, day: '2026-09-30' },
      { userId: ana, day: '2026-10-01' },
    ])
    await db.insert(schema.userProgression).values({ userId: ana, level: 4, xp: 400 })
    await db.insert(schema.duels).values([
      {
        challengerId: ana,
        opponentId: bia,
        status: 'finished',
        expiresAt: new Date('2026-09-20T00:00:00Z'),
        finishedAt: new Date('2026-09-20T00:00:00Z'),
        outcome: 'challenger',
        reason: 'profitability',
      },
      {
        challengerId: bia,
        opponentId: ana,
        status: 'finished',
        expiresAt: new Date('2026-09-25T00:00:00Z'),
        finishedAt: new Date('2026-09-25T00:00:00Z'),
        outcome: 'draw',
        reason: 'both_inactive',
      },
    ])

    const read = await createDrizzleMonthActivityReader(db).read(ana, range)

    expect(read.activeDays).toEqual(expect.arrayContaining([1, 2, 30]))
    expect(read.activeDays).toHaveLength(3)
    expect(read.level).toBe(4)
    expect(read.duelsPlayed).toBe(1)
    expect(read.duelsWon).toBe(1)
    expect(read.leaguesActive).toBe(0)
    // lições concluídas dependem de uma lição completa (muitas colunas): conferido no compose com dados reais
    expect(read.lessonsCompleted).toBe(0)
  })

  it('quem nunca jogou lê tudo zerado, com nível 1', async () => {
    const read = await createDrizzleMonthActivityReader(db).read(bia, range)
    expect(read).toEqual({
      lessonsCompleted: 0,
      achievementNames: [],
      level: 1,
      activeDays: [],
      duelsPlayed: 0,
      duelsWon: 0,
      leaguesActive: 0,
    })
  })

  it('arquivo grava uma vez e mantém a primeira versão (idempotente)', async () => {
    const repo = createDrizzleRetrospectiveRepository(db)
    const data = (lessons: number): RetrospectiveData => ({
      month: '2026-09',
      lessonsCompleted: lessons,
      achievementsUnlocked: 0,
      achievementNames: [],
      level: 1,
      activeDays: [],
      daysInMonth: 30,
      longestStreak: 0,
      bestReturnPct: 1.5,
      duelsPlayed: 0,
      duelsWon: 0,
      leaguesActive: 0,
    })
    expect(await repo.find(ana, '2026-09')).toBeNull()
    expect((await repo.saveIfAbsent(ana, '2026-09', data(3))).lessonsCompleted).toBe(3)
    expect((await repo.saveIfAbsent(ana, '2026-09', data(9))).lessonsCompleted).toBe(3)
    expect([...(await repo.listUserIdsWith('2026-09'))]).toEqual([ana])
  })

  it('só contas ativas entram no job e a data de criação vem do cadastro', async () => {
    const reader = createDrizzleMonthActivityReader(db)
    expect((await reader.listActiveUserIds()).sort()).toEqual([ana, bia].sort())
    expect(await reader.findCreatedAt(ana)).toBeInstanceOf(Date)
    expect(await reader.findCreatedAt('00000000-0000-4000-8000-000000000000')).toBeNull()
  })
})
