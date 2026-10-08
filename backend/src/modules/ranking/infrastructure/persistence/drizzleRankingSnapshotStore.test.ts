import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleRankingSnapshotStore } from './drizzleRankingSnapshotStore'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleRankingSnapshotStore (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    await db.delete(schema.rankingSnapshots)
  })

  afterAll(async () => {
    await db.delete(schema.rankingSnapshots)
    await pool.end()
  })

  async function createUsers(count: number) {
    const suffix = Date.now().toString(36)
    return db
      .insert(schema.users)
      .values(
        Array.from({ length: count }, (_, i) => ({
          name: `U${i}`,
          email: `rs${i}-${suffix}@t.dev`,
          username: `rs${i}${suffix}`,
        })),
      )
      .returning({ id: schema.users.id, username: schema.users.username })
  }

  const entry = (u: { id: string; username: string }, pct: number | null, xp = 0) => ({
    userId: u.id,
    username: u.username,
    level: 1,
    xp,
    profitabilityPct: pct,
    sortKey: pct ?? xp,
  })

  it('sem rodada, devolve null', async () => {
    const store = createDrizzleRankingSnapshotStore(db)
    expect(await store.readLatest('overall', 'week')).toBeNull()
  })

  it('lê a última rodada, na ordem de posição, separada por critério e janela', async () => {
    const [a, b] = await createUsers(2)
    const store = createDrizzleRankingSnapshotStore(db)

    await store.saveRun({
      computedAt: new Date('2026-08-26T06:00:00Z'),
      groups: [{ criterion: 'overall', window: 'week', entries: [entry(a, 1), entry(b, 0)] }],
    })
    await store.saveRun({
      computedAt: new Date('2026-08-26T09:00:00Z'),
      groups: [
        { criterion: 'overall', window: 'week', entries: [entry(b, 5), entry(a, 2)] },
        { criterion: 'level', window: null, entries: [entry(a, null, 90), entry(b, null, 10)] },
      ],
    })

    const week = await store.readLatest('overall', 'week')
    expect(week?.computedAt).toEqual(new Date('2026-08-26T09:00:00Z'))
    expect(week?.entries.map((e) => e.userId)).toEqual([b.id, a.id])
    expect(week?.entries[0]).toMatchObject({ profitabilityPct: 5, sortKey: 5 })

    const level = await store.readLatest('level', null)
    expect(level?.entries.map((e) => e.userId)).toEqual([a.id, b.id])
    expect(level?.entries[0].profitabilityPct).toBeNull()

    expect(await store.readLatest('overall', 'month')).toEqual({
      computedAt: new Date('2026-08-26T09:00:00Z'),
      entries: [],
    })
  })

  it('deleteRunsBefore apaga só as rodadas anteriores ao corte', async () => {
    const store = createDrizzleRankingSnapshotStore(db)
    await store.deleteRunsBefore(new Date('2026-08-26T08:00:00Z'))

    const week = await store.readLatest('overall', 'week')
    expect(week?.computedAt).toEqual(new Date('2026-08-26T09:00:00Z'))
    const rows = await db.select().from(schema.rankingSnapshots)
    expect(
      rows.every((r) => r.computedAt.getTime() >= new Date('2026-08-26T08:00:00Z').getTime()),
    ).toBe(true)
  })
})
