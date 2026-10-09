import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import type { Snapshot } from '../../domain/networth'
import { createDrizzleRankingValuationSampleStore } from './drizzleRankingValuationSampleStore'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

function snapshot(fixedIncomeValue: number): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: 0,
    fixedIncomeValue,
    tradesExecuted: 0,
    total: fixedIncomeValue,
    investedCost: 1000,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    byClass: {
      fixedIncome: { investedCost: 1000, disinvestedProceeds: 0, dividendsReceived: 0 },
      variableIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
    },
  }
}

describe.skipIf(!databaseUrl)('drizzleRankingValuationSampleStore (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    await db.delete(schema.rankingValuationSamples)
  })

  afterAll(async () => {
    await db.delete(schema.rankingValuationSamples)
    await pool.end()
  })

  it('devolve por usuário a amostra mais antiga da faixa e preserva o snapshot', async () => {
    const suffix = Date.now().toString(36)
    const [user] = await db
      .insert(schema.users)
      .values({ name: 'S', email: `vs-${suffix}@t.dev`, username: `vs${suffix}` })
      .returning({ id: schema.users.id })
    const store = createDrizzleRankingValuationSampleStore(db)

    await store.saveSamples(new Date('2026-08-24T03:00:00Z'), [
      { userId: user.id, snapshot: snapshot(1008) },
    ])
    await store.saveSamples(new Date('2026-08-24T00:30:00Z'), [
      { userId: user.id, snapshot: snapshot(1005) },
    ])
    await store.saveSamples(new Date('2026-08-24T09:00:00Z'), [
      { userId: user.id, snapshot: snapshot(1020) },
    ])

    const found = await store.findBaselines(
      new Date('2026-08-24T00:00:00Z'),
      new Date('2026-08-24T04:00:00Z'),
    )

    expect(found.get(user.id)).toEqual(snapshot(1005))
    expect(found.size).toBe(1)
  })

  it('deleteSamplesBefore apaga só as amostras anteriores ao corte', async () => {
    const store = createDrizzleRankingValuationSampleStore(db)

    await store.deleteSamplesBefore(new Date('2026-08-24T02:00:00Z'))

    const rows = await db.select().from(schema.rankingValuationSamples)
    expect(rows.map((r) => r.computedAt.toISOString()).sort()).toEqual([
      '2026-08-24T03:00:00.000Z',
      '2026-08-24T09:00:00.000Z',
    ])
  })
})
