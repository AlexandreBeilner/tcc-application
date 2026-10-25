import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { deleteAllUsers } from '../../../../db/test/deleteAllUsers'
import { createDrizzleMilestoneRepository } from './drizzleMilestoneRepository'
import { createDrizzlePresenceRepository } from './drizzlePresenceRepository'

// Integração (RT.1.1): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// várias tabelas de usuário). Prova a idempotência das duas gravações no Postgres real.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('registro de retenção (banco real)', () => {
  let pool: Pool
  let db: Database
  let userId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.dailyPresence)
    await db.delete(schema.userMilestones)
    await deleteAllUsers(db)
    const [row] = await db
      .insert(schema.users)
      .values({ name: 'ana', username: 'ana', email: 'ana@x.com', passwordHash: 'x' })
      .returning({ id: schema.users.id })
    userId = row.id
  })

  afterAll(async () => {
    await pool.end()
  })

  it('presença do mesmo dia gravada duas vezes fica numa linha só', async () => {
    const repo = createDrizzlePresenceRepository(db)
    await repo.record(userId, '2026-10-18')
    await repo.record(userId, '2026-10-18')
    await repo.record(userId, '2026-10-19')
    const rows = await db.select().from(schema.dailyPresence)
    expect(rows.map((r) => r.day).sort()).toEqual(['2026-10-18', '2026-10-19'])
  })

  it('o mesmo marco gravado duas vezes não duplica e mantém a primeira data', async () => {
    const repo = createDrizzleMilestoneRepository(db)
    await repo.recordIfAbsent(userId, 'first_lesson', new Date('2026-10-18T10:00:00Z'))
    await repo.recordIfAbsent(userId, 'first_lesson', new Date('2026-10-25T10:00:00Z'))
    await repo.recordIfAbsent(userId, 'first_trade', new Date('2026-10-26T10:00:00Z'))
    const rows = await db.select().from(schema.userMilestones)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.milestone === 'first_lesson')?.reachedAt).toEqual(
      new Date('2026-10-18T10:00:00Z'),
    )
  })
})
