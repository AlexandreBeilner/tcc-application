import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleAuthEmailTokenRepository } from './drizzleAuthEmailTokenRepository'
import { createDrizzleUserRepository } from './drizzleUserRepository'

// Integração do adapter real (EM.2.1): só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL. Cobre o que os fakes não provam: a transação de `replaceActive` e o consumo
// atômico de `markUsed` com requisições simultâneas.
const databaseUrl = process.env.TEST_DATABASE_URL
const NOW = new Date('2026-10-10T12:00:00Z')

describe.skipIf(!databaseUrl)('drizzleAuthEmailTokenRepository (banco real)', () => {
  let pool: Pool
  let db: Database

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 10 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  afterAll(async () => {
    await pool.end()
  })

  async function newUser() {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    return createDrizzleUserRepository(db).createUser({
      name: 'Token',
      email: `token-${suffix}@t.dev`,
      username: `token${suffix}`,
      passwordHash: null,
    })
  }

  const input = (userId: string, tokenHash: string) => ({
    userId,
    kind: 'password_reset' as const,
    tokenHash,
    expiresAt: new Date(NOW.getTime() + 30 * 60_000),
  })

  it('grava o token, acha pelo hash e um pedido novo invalida o anterior', async () => {
    const repo = createDrizzleAuthEmailTokenRepository(db)
    const user = await newUser()
    const hashA = `a-${user.id}`.padEnd(64, '0')
    const hashB = `b-${user.id}`.padEnd(64, '0')

    const first = await repo.replaceActive(input(user.id, hashA), NOW)
    const second = await repo.replaceActive(input(user.id, hashB), NOW)

    expect(await repo.findByHash(hashA, 'password_reset')).toMatchObject({
      id: first.id,
      userId: user.id,
      usedAt: NOW,
    })
    expect(await repo.findByHash(hashB, 'password_reset')).toMatchObject({
      id: second.id,
      usedAt: null,
    })
    expect(await repo.findByHash(hashB, 'email_verification')).toBeUndefined()
  })

  it('markUsed é atômico: de várias requisições simultâneas só uma consome o token', async () => {
    const repo = createDrizzleAuthEmailTokenRepository(db)
    const user = await newUser()
    const { id } = await repo.replaceActive(input(user.id, `c-${user.id}`.padEnd(64, '0')), NOW)

    const results = await Promise.all(Array.from({ length: 8 }, () => repo.markUsed(id, NOW)))

    expect(results.filter(Boolean)).toHaveLength(1)
  })
})
