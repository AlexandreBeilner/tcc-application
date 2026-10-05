import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleUserDirectory } from './drizzleUserDirectory'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('ranking drizzleUserDirectory (banco real)', () => {
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

  it('conta suspensa sai do ranking e volta quando reativada', async () => {
    const suffix = Date.now().toString(36)
    const [active, suspended] = await db
      .insert(schema.users)
      .values([
        { name: 'A', email: `a-${suffix}@t.dev`, username: `rka${suffix}` },
        { name: 'B', email: `b-${suffix}@t.dev`, username: `rkb${suffix}`, status: 'suspended' },
      ])
      .returning({ id: schema.users.id })
    const directory = createDrizzleUserDirectory(db)

    const ids = (await directory.listAll()).map((u) => u.id)
    expect(ids).toContain(active.id)
    expect(ids).not.toContain(suspended.id)

    await db.update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, suspended.id))
    expect((await directory.listAll()).map((u) => u.id)).toContain(suspended.id)
  })
})
