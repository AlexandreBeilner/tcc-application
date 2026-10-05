import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleAdminUserDirectory } from './drizzleAdminUserDirectory'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava usuários). Nunca o `gamification` de dev.
// Com mais de um arquivo de integração no mesmo banco, rode com `--no-file-parallelism`.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleAdminUserDirectory (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
    const base = new Date('2026-01-10T00:00:00Z')
    const rows = await db
      .insert(schema.users)
      .values([
        {
          name: 'Ana Souza',
          email: `ana-${suffix}@t.dev`,
          username: `ana${suffix}`,
          passwordHash: 'h',
          createdAt: base,
        },
        {
          name: 'Beto 100%',
          email: `beto-${suffix}@t.dev`,
          username: `beto${suffix}`,
          passwordHash: null,
          status: 'suspended',
          createdAt: new Date('2026-02-10T00:00:00Z'),
        },
        {
          name: 'Admin Z',
          email: `adm-${suffix}@t.dev`,
          username: `adm${suffix}`,
          passwordHash: 'h',
          role: 'admin',
          createdAt: new Date('2026-03-10T00:00:00Z'),
        },
      ])
      .returning({ id: schema.users.id, username: schema.users.username })
    for (const row of rows) ids[row.username.replace(suffix, '')] = row.id
    await db
      .insert(schema.userIdentities)
      .values({ userId: ids.beto, providerName: 'google', providerAccountId: `g-${suffix}` })
  })

  afterAll(async () => {
    await pool.end()
  })

  const list = (query: Parameters<ReturnType<typeof createDrizzleAdminUserDirectory>['list']>[0]) =>
    createDrizzleAdminUserDirectory(db).list(query)

  it('busca por nome, e-mail, username e id exato, sem tratar % como curinga', async () => {
    expect(
      (await list({ q: `ana${suffix}`, limit: 10, offset: 0 })).users.map((u) => u.name),
    ).toEqual(['Ana Souza'])
    expect((await list({ q: `beto-${suffix}@t`, limit: 10, offset: 0 })).total).toBe(1)
    expect((await list({ q: ids.adm, limit: 10, offset: 0 })).users[0].role).toBe('admin')
    expect(
      (await list({ q: '100%', limit: 10, offset: 0 })).users.map((u) => u.username),
    ).toContain(`beto${suffix}`)
    expect((await list({ q: `%${suffix}`, limit: 10, offset: 0 })).total).toBe(0)
  })

  it('filtra por papel, status, provedor e data de cadastro', async () => {
    const mine = { q: suffix, limit: 10, offset: 0 }
    expect((await list({ ...mine, role: 'admin' })).total).toBe(1)
    expect((await list({ ...mine, status: 'suspended' })).users.map((u) => u.name)).toEqual([
      'Beto 100%',
    ])
    expect((await list({ ...mine, provider: 'google' })).users.map((u) => u.name)).toEqual([
      'Beto 100%',
    ])
    expect((await list({ ...mine, provider: 'password' })).total).toBe(2)
    const window = await list({
      ...mine,
      createdFrom: new Date('2026-02-01T00:00:00Z'),
      createdTo: new Date('2026-02-28T00:00:00Z'),
    })
    expect(window.users.map((u) => u.name)).toEqual(['Beto 100%'])
  })

  it('devolve os provedores de cada conta, mais recentes primeiro, com paginação e total', async () => {
    const page = await list({ q: suffix, limit: 2, offset: 0 })
    expect(page.total).toBe(3)
    expect(page.users.map((u) => u.username)).toEqual([`adm${suffix}`, `beto${suffix}`])
    expect(page.users[1].providers).toEqual(['google'])
    expect(page.users[0].providers).toEqual(['password'])
    expect((await list({ q: suffix, limit: 2, offset: 2 })).users).toHaveLength(1)
  })
})
