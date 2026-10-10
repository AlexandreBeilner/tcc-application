import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleUserDirectory, escapeLikePattern } from './drizzleUserDirectory'

describe('escapeLikePattern', () => {
  it('escapa "_" pra não casar como wildcard de 1 caractere no ILIKE', () => {
    expect(escapeLikePattern('joao_silva')).toBe('joao\\_silva')
  })

  it('escapa "%" pra não casar como wildcard de N caracteres no ILIKE', () => {
    expect(escapeLikePattern('100%joao')).toBe('100\\%joao')
  })

  it('escapa "\\" antes das trocas de "%"/"_" pra não dobrar o escape', () => {
    expect(escapeLikePattern('joao\\_silva')).toBe('joao\\\\\\_silva')
  })

  it('mantém intacta uma query sem caractere especial', () => {
    expect(escapeLikePattern('joaosilva')).toBe('joaosilva')
  })
})

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('friendships drizzleUserDirectory (banco real)', () => {
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

  it('a busca de amigos não devolve conta suspensa (N.16)', async () => {
    const suffix = Date.now().toString(36)
    const [me] = await db
      .insert(schema.users)
      .values([
        { name: 'Eu', email: `eu-${suffix}@t.dev`, username: `eu${suffix}` },
        { name: 'Ativo', email: `at-${suffix}@t.dev`, username: `busca${suffix}ativo` },
        {
          name: 'Suspenso',
          email: `su-${suffix}@t.dev`,
          username: `busca${suffix}susp`,
          status: 'suspended',
        },
      ])
      .returning({ id: schema.users.id })

    const found = await createDrizzleUserDirectory(db).searchByUsername(`busca${suffix}`, me.id)

    expect(found.map((u) => u.username)).toEqual([`busca${suffix}ativo`])
  })
})
