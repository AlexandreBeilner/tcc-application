import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { deleteAllUsers } from '../../../../db/test/deleteAllUsers'
import { createDrizzleDuelRepository } from './drizzleDuelRepository'

// Integração (MO.5.3): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// `duels`, `social_feed_events` e `users`). Prova o teto de vagas sob concorrência, a trava de
// aceite e as transições condicionais ao estado.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositório de duelos (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]
  const now = new Date('2026-10-10T12:00:00Z')
  const later = new Date('2026-10-17T12:00:00Z')

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.retrospectives)
    await db.delete(schema.dailyActivity)
    await db.delete(schema.duels)
    await db.delete(schema.socialFeedEvents)
    await db.delete(schema.leagueMembers)
    await db.delete(schema.leagues)
    await db.delete(schema.userCosmetics)
    await db.delete(schema.emailOutbox)
    await db.delete(schema.emailPreferences)
    await deleteAllUsers(db)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'bia', 'caio', 'dani', 'edu', 'fabi'].map((u) => ({
          name: u,
          username: u,
          email: `${u}@exemplo.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    ids = rows.map((r) => r.id)
  })

  afterAll(async () => {
    await pool.end()
  })

  const input = (challengerId: string, opponentId: string) => ({
    challengerId,
    opponentId,
    now,
    expiresAt: later,
  })

  it('desafios simultâneos da mesma pessoa não furam o teto de vagas', async () => {
    const repo = createDrizzleDuelRepository(db)
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => repo.createIfRoom(input(ids[0], ids[i]), 3)),
    )
    expect(results.filter((r) => r !== null)).toHaveLength(3)
  })

  it('aceitar respeita o teto do desafiado e só vale uma vez', async () => {
    const repo = createDrizzleDuelRepository(db)
    const created = []
    for (const challenger of [1, 2, 3, 4]) {
      created.push((await repo.createIfRoom(input(ids[challenger], ids[0]), 3))!)
    }
    const accepted = await Promise.all(
      created.map((d) => repo.acceptIfRoom(d.id, ids[0], now, later, 3)),
    )
    expect(accepted.filter((r) => r === 'accepted')).toHaveLength(3)
    expect(accepted.filter((r) => r === 'full')).toHaveLength(1)

    expect(await repo.acceptIfRoom(created[0].id, ids[0], now, later, 3)).toBe('gone')
    expect(await repo.acceptIfRoom(created[0].id, ids[2], now, later, 3)).toBe('gone')
  })

  it('transições só valem a partir do estado certo (corrida de dois processos)', async () => {
    const repo = createDrizzleDuelRepository(db)
    const duel = (await repo.createIfRoom(input(ids[0], ids[1]), 3))!
    expect(await repo.cancel(duel.id, now)).toBe(true)
    expect(await repo.cancel(duel.id, now)).toBe(false)
    expect(await repo.decline(duel.id, now)).toBe(false)

    const active = (await repo.createIfRoom(input(ids[0], ids[2]), 3))!
    await repo.acceptIfRoom(active.id, ids[2], now, later, 3)
    const result = {
      outcome: 'challenger' as const,
      reason: 'profitability' as const,
      challengerPct: 5.5,
      opponentPct: 1.25,
      challengerOperated: true,
      opponentOperated: true,
    }
    const [first, second] = await Promise.all([
      repo.finish(active.id, result, later),
      repo.finish(active.id, result, later),
    ])
    expect([first, second].filter(Boolean)).toHaveLength(1)

    const done = (await repo.findById(active.id))!
    expect(done).toMatchObject({ status: 'finished', outcome: 'challenger', challengerPct: 5.5 })
    expect(done.xpAwardedAt).toBeNull()
    expect((await repo.listFinishedWithoutXp(10)).map((d) => d.id)).toEqual([active.id])
    await repo.markXpAwarded(active.id, later)
    expect(await repo.listFinishedWithoutXp(10)).toEqual([])
  })

  it('lista vencidos, expirados e o duelo aberto entre duas pessoas', async () => {
    const repo = createDrizzleDuelRepository(db)
    const pending = (await repo.createIfRoom(input(ids[0], ids[1]), 3))!
    const active = (await repo.createIfRoom(input(ids[0], ids[2]), 3))!
    await repo.acceptIfRoom(active.id, ids[2], now, later, 3)

    expect((await repo.findOpenBetween(ids[1], ids[0]))?.id).toBe(pending.id)
    expect(await repo.findOpenBetween(ids[1], ids[2])).toBeNull()

    const afterEnd = new Date(later.getTime() + 1000)
    expect((await repo.listDueActive(now)).length).toBe(0)
    expect((await repo.listDueActive(afterEnd)).map((d) => d.id)).toEqual([active.id])
    expect((await repo.listExpiredPending(afterEnd)).map((d) => d.id)).toEqual([pending.id])
    expect(await repo.expire(pending.id, afterEnd)).toBe(true)
    expect(await repo.findOpenBetween(ids[0], ids[1])).toBeNull()
  })

  it('rejeita desafiar a si mesmo (constraint)', async () => {
    await expect(
      db.insert(schema.duels).values({
        challengerId: ids[0],
        opponentId: ids[0],
        status: 'pending',
        expiresAt: later,
      }),
    ).rejects.toThrow()
  })
})
