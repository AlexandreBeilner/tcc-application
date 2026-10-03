import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleUserStatsReader } from './drizzleUserStatsReader'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava usuários). Nunca o `gamification` de dev.
// Com mais de um arquivo de integração no mesmo banco, rode com `--no-file-parallelism`:
// as migrations concorrentes disputam a criação do schema `drizzle`.
const databaseUrl = process.env.TEST_DATABASE_URL
const DAY_MS = 24 * 60 * 60 * 1000

describe.skipIf(!databaseUrl)('drizzleUserStatsReader (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
  })

  afterAll(async () => {
    await pool.end()
  })

  it('conta só role = user e separa os cadastros das últimas 24h e 7 dias', async () => {
    const reader = createDrizzleUserStatsReader(db)
    const now = new Date()
    const before = await reader.read(now)
    const suffix = Date.now().toString(36)
    const user = (n: string, ageDays: number, role: 'user' | 'admin' = 'user') => ({
      name: n,
      email: `${n}-${suffix}@t.dev`,
      username: `${n}${suffix}`.slice(0, 30),
      role,
      createdAt: new Date(now.getTime() - ageDays * DAY_MS),
    })
    await db
      .insert(schema.users)
      .values([user('novo', 0.1), user('semana', 3), user('antigo', 30), user('adm', 0.1, 'admin')])

    const after = await reader.read(now)

    expect(after.total - before.total).toBe(3)
    expect(after.signups_last_24h - before.signups_last_24h).toBe(1)
    expect(after.signups_last_7d - before.signups_last_7d).toBe(2)
  })
})
