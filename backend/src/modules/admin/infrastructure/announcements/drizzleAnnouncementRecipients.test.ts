import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { inArray } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleAnnouncementRecipients } from './drizzleAnnouncementRecipients'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations). Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleAnnouncementRecipients (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const ids: Record<string, string> = {}
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    const verifiedAt = new Date()
    const rows = [
      { key: 'ok1', email: `ok1-${suffix}@t.dev`, emailVerifiedAt: verifiedAt },
      { key: 'ok2', email: `ok2-${suffix}@t.dev`, emailVerifiedAt: verifiedAt },
      { key: 'unverified', email: `unv-${suffix}@t.dev`, emailVerifiedAt: null },
      {
        key: 'suspended',
        email: `sus-${suffix}@t.dev`,
        emailVerifiedAt: verifiedAt,
        status: 'suspended',
      },
      {
        key: 'anon',
        email: `usuario-removido-${suffix}@anonimo.invalid`,
        emailVerifiedAt: verifiedAt,
      },
    ]
    for (const row of rows) {
      const [created] = await db
        .insert(schema.users)
        .values({
          name: row.key,
          email: row.email,
          username: `rcp-${row.key}-${suffix}`,
          emailVerifiedAt: row.emailVerifiedAt,
          status: row.status ?? 'active',
        })
        .returning({ id: schema.users.id })
      ids[row.key] = created!.id
    }
  })

  afterAll(async () => {
    await db.delete(schema.users).where(inArray(schema.users.id, Object.values(ids)))
    await pool.end()
  })

  async function listAll(pageSize: number): Promise<string[]> {
    const recipients = createDrizzleAnnouncementRecipients(db)
    const seen: string[] = []
    let cursor: string | null = null
    for (;;) {
      const page = await recipients.listPage(cursor, pageSize)
      if (page.length === 0) break
      seen.push(...page.map((r) => r.userId))
      cursor = page[page.length - 1]!.userId
    }
    return seen
  }

  it('só contas ativas com e-mail verificado e não anonimizadas', async () => {
    const seen = await listAll(1000)

    expect(seen).toContain(ids.ok1)
    expect(seen).toContain(ids.ok2)
    expect(seen).not.toContain(ids.unverified)
    expect(seen).not.toContain(ids.suspended)
    expect(seen).not.toContain(ids.anon)
  })

  it('a paginação por cursor devolve o mesmo conjunto, sem repetir ninguém', async () => {
    const all = await listAll(1000)
    const paged = await listAll(1)

    expect(paged).toEqual(all)
    expect(new Set(paged).size).toBe(paged.length)
  })
})
