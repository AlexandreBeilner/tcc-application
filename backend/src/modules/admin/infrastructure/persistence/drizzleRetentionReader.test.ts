import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { deleteAllUsers } from '../../../../db/test/deleteAllUsers'
import { addDays, weekStart } from '../../domain/retention'
import {
  createInMemoryRetentionReader,
  type RetentionDataset,
} from '../../test/fakes/inMemoryRetentionReader'
import { buildSyntheticRetention } from '../../test/retentionDataset'
import { createDrizzleRetentionReader } from './drizzleRetentionReader'

// Integração do adapter real (RT.1.2): só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (apaga usuários e as tabelas de presença, atividade e marcos). Grava o MESMO conjunto
// sintético (milhares de pessoas, meses de uso) que o oráculo em memória e exige resultados iguais,
// então o SQL é provado contra a definição escrita em TypeScript.
const databaseUrl = process.env.TEST_DATABASE_URL

const TODAY = '2026-10-18'

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

describe.skipIf(!databaseUrl)('drizzleRetentionReader (banco real)', () => {
  let pool: Pool
  let db: Database
  let oracle: ReturnType<typeof createInMemoryRetentionReader>
  let dataset: RetentionDataset

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database

    await db.delete(schema.dailyPresence)
    await db.delete(schema.dailyActivity)
    await db.delete(schema.userMilestones)
    await deleteAllUsers(db)

    const synthetic = buildSyntheticRetention({
      users: 3000,
      admins: 25,
      today: TODAY,
      firstSignupDay: '2026-03-02',
      presenceSince: '2026-06-01',
      activitySince: '2026-05-01',
      seed: 7,
    })
    const uuid = new Map(synthetic.users.map((u) => [u.id, randomUUID()]))
    const remap = (set: Set<string>) =>
      new Set(
        [...set].map((entry) => {
          const [id, day] = entry.split('|')
          return `${uuid.get(id)}|${day}`
        }),
      )
    dataset = {
      users: synthetic.users.map((u) => ({ ...u, id: uuid.get(u.id) as string })),
      presence: remap(synthetic.presence),
      activity: remap(synthetic.activity),
      milestones: synthetic.milestones.map((m) => ({ ...m, userId: uuid.get(m.userId) as string })),
    }

    for (const batch of chunks(dataset.users, 1000)) {
      await db.insert(schema.users).values(
        batch.map((u, i) => ({
          id: u.id,
          name: `u${i}`,
          username: `u${u.id.slice(0, 8)}${i}`,
          email: `${u.id}@retention.test`,
          passwordHash: 'x',
          role: u.role ?? 'user',
          createdAt: u.createdAt,
        })),
      )
    }
    const rows = (set: Set<string>) =>
      [...set].map((entry) => {
        const [userId, day] = entry.split('|')
        return { userId, day }
      })
    for (const batch of chunks(rows(dataset.presence), 5000)) {
      await db.insert(schema.dailyPresence).values(batch)
    }
    for (const batch of chunks(rows(dataset.activity), 5000)) {
      await db.insert(schema.dailyActivity).values(batch)
    }
    for (const batch of chunks(dataset.milestones, 5000)) {
      await db.insert(schema.userMilestones).values(batch)
    }
    // Milhares de linhas trocadas de uma vez deixam as estatísticas do planejador velhas até o autovacuum passar;
    // com elas, a consulta dos marcos chegou a passar dos 5 s do teste (71 ms com estatística atualizada).
    await db.execute(sql`ANALYZE users, daily_presence, daily_activity, user_milestones`)
    oracle = createInMemoryRetentionReader(dataset)
  }, 120_000)

  afterAll(async () => {
    await db.delete(schema.dailyPresence)
    await db.delete(schema.dailyActivity)
    await db.delete(schema.userMilestones)
    await deleteAllUsers(db)
    await pool.end()
  })

  const byKey = <T extends { cohortWeek: string; offset?: number }>(rows: T[]) =>
    [...rows].sort((a, b) =>
      `${a.cohortWeek}|${a.offset ?? 0}`.localeCompare(`${b.cohortWeek}|${b.offset ?? 0}`),
    )

  it('o início do registro é o primeiro dia com linha em cada tabela', async () => {
    const reader = createDrizzleRetentionReader(db)
    expect(await reader.trackingStart()).toEqual(await oracle.trackingStart())
    expect(await reader.trackingStart()).toEqual({
      presenceSince: '2026-06-01',
      activitySince: '2026-05-01',
    })
  })

  it('as contagens das coortes batem com o oráculo, nas duas medidas e nos três dias', async () => {
    const reader = createDrizzleRetentionReader(db)
    const tracking = await reader.trackingStart()
    const params = {
      fromWeek: addDays(weekStart(TODAY), -51 * 7),
      offsets: [1, 7, 30],
      today: TODAY,
      tracking,
    }
    const real = byKey(await reader.cohortCounts(params))
    const expected = byKey(await oracle.cohortCounts(params))
    expect(real.length).toBeGreaterThan(60)
    expect(real).toEqual(expected)
    // Sem administradores: o total de cada offset é o número de pessoas.
    const total = real.filter((r) => r.offset === 7).reduce((sum, r) => sum + r.size, 0)
    expect(total).toBe(3000)
  })

  it('ativos por dia e MAU batem com o oráculo', async () => {
    const reader = createDrizzleRetentionReader(db)
    const params = { from: '2026-05-20', to: '2026-10-17' }
    const real = await reader.dailyActive(params)
    expect(real).toHaveLength(151)
    expect(real).toEqual(await oracle.dailyActive(params))
  })

  it('marcos (inclusive primeiro retorno) batem com o oráculo, mediana incluída', async () => {
    const reader = createDrizzleRetentionReader(db)
    const params = { fromWeek: addDays(weekStart(TODAY), -51 * 7), trackingSince: '2026-06-02' }
    const real = await reader.milestoneStats(params)
    const expected = await oracle.milestoneStats(params)
    expect(real.eligible).toBe(expected.eligible)
    expect(real.eligible).toBeGreaterThan(1000)
    const sortOverall = (rows: typeof real.overall) =>
      [...rows].sort((a, b) => a.milestone.localeCompare(b.milestone))
    const realOverall = sortOverall(real.overall)
    const expectedOverall = sortOverall(expected.overall)
    expect(realOverall.map((r) => [r.milestone, r.reached])).toEqual(
      expectedOverall.map((r) => [r.milestone, r.reached]),
    )
    realOverall.forEach((row, i) => {
      expect(row.medianSeconds).toBeCloseTo(expectedOverall[i].medianSeconds as number, 3)
    })
    expect(byKey(real.byCohort)).toEqual(byKey(expected.byCohort))
  })

  it('sem início de registro não há elegíveis para os marcos', async () => {
    const reader = createDrizzleRetentionReader(db)
    expect(await reader.milestoneStats({ fromWeek: '2026-01-05', trackingSince: null })).toEqual({
      eligible: 0,
      overall: [],
      byCohort: [],
    })
  })
})
