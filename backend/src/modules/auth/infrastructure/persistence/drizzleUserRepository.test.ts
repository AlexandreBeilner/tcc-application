import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleUserRepository } from './drizzleUserRepository'

// Integração do adapter real (suspensão e versão de sessão, N.16): só roda com
// TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL. Nunca o `gamification` de dev.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleUserRepository, suspensão e sessão (banco real)', () => {
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

  it('usuário novo nasce ativo, sem motivo e na versão 0', async () => {
    const suffix = Date.now().toString(36)
    const user = await createDrizzleUserRepository(db).createUser({
      name: 'Novo',
      email: `novo-${suffix}@t.dev`,
      username: `novo${suffix}`,
      passwordHash: null,
    })
    expect(user).toMatchObject({
      status: 'active',
      suspendedReason: null,
      suspendedAt: null,
      tokenVersion: 0,
      emailVerifiedAt: null,
    })
  })

  it('suspende com motivo, reativa e incrementa a versão de forma atômica', async () => {
    const repository = createDrizzleUserRepository(db)
    const suffix = Date.now().toString(36)
    const { id } = await repository.createUser({
      name: 'Susp',
      email: `susp-${suffix}@t.dev`,
      username: `susp${suffix}`,
      passwordHash: null,
    })
    const at = new Date('2026-10-03T12:00:00Z')

    const suspended = await repository.updateUser(id, {
      status: 'suspended',
      suspendedReason: 'spam',
      suspendedAt: at,
    })
    expect(suspended).toMatchObject({ status: 'suspended', suspendedReason: 'spam' })
    expect(suspended.suspendedAt?.toISOString()).toBe(at.toISOString())

    const versions = await Promise.all([
      repository.revokeSessions(id),
      repository.revokeSessions(id),
      repository.revokeSessions(id),
    ])
    expect([...versions].sort()).toEqual([1, 2, 3])

    const active = await repository.updateUser(id, {
      status: 'active',
      suspendedReason: null,
      suspendedAt: null,
    })
    expect(active).toMatchObject({
      status: 'active',
      suspendedReason: null,
      suspendedAt: null,
      tokenVersion: 3,
    })
  })

  it('o banco recusa um status fora de active/suspended', async () => {
    const suffix = Date.now().toString(36)
    await expect(
      db.insert(schema.users).values({
        name: 'X',
        email: `x-${suffix}@t.dev`,
        username: `x${suffix}`,
        status: 'banido',
      }),
    ).rejects.toThrow()
  })
})
