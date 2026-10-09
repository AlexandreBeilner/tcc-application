import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleUsersExportSource } from './drizzleUsersExportSource'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleUsersExportSource (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    await db.insert(schema.users).values(
      [1, 2, 3].map((n) => ({
        name: `Export ${n}`,
        email: `export${n}-${suffix}@t.dev`,
        username: `exp${n}${suffix}`,
        passwordHash: 'hash-secreto',
        createdAt: new Date(`2026-10-0${n}T12:00:00Z`),
      })),
    )
  })

  afterAll(async () => {
    await pool.end()
  })

  it('nunca expõe hash de senha, token nem patrimônio', async () => {
    const table = await createDrizzleUsersExportSource(db).fetch({}, 10)
    expect(table.columns).toEqual([
      'id',
      'name',
      'email',
      'username',
      'role',
      'status',
      'onboarding_completed',
      'created_at',
    ])
    expect(JSON.stringify(table.rows)).not.toContain('hash-secreto')
  })

  it('filtra por período inclusivo e respeita o teto, marcando o truncamento', async () => {
    const source = createDrizzleUsersExportSource(db)
    const ranged = await source.fetch(
      { from: new Date('2026-10-02T00:00:00Z'), to: new Date('2026-10-03T23:59:59Z') },
      10,
    )
    const ours = ranged.rows.filter((r) => String(r[2]).endsWith(`-${suffix}@t.dev`))
    expect(ours).toHaveLength(2)

    const capped = await source.fetch(
      { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-03T23:59:59Z') },
      1,
    )
    expect(capped.rows).toHaveLength(1)
    expect(capped.truncated).toBe(true)
  })
})
