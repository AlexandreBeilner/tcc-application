import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleCosmeticCatalogRepository } from '../../../cosmetics/infrastructure/persistence/drizzleCosmeticCatalogRepository'
import { AttributeReferralUseCase } from '../../application/useCases/attributeReferral'
import { QualifyReferralUseCase } from '../../application/useCases/qualifyReferral'
import { createDrizzleReferralRepository } from './drizzleReferralRepository'

// Integração (MO.7.2): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL. Prova as
// constraints reais (uma conta indicada conta uma vez, auto-indicação) e a concorrência do
// indicador.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositórios de indicação (banco real)', () => {
  let pool: Pool
  let db: Database
  let owner: string
  let friends: string[]

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.referrals)
    await db.delete(schema.referralCodes)
    await db.delete(schema.users)
    const rows = await db
      .insert(schema.users)
      .values(
        Array.from({ length: 8 }, (_, i) => ({
          name: `U${i}`,
          username: `u${i}`,
          email: `u${i}@exemplo.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    owner = rows[0].id
    friends = rows.slice(1).map((r) => r.id)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('a migração entrega os 3 títulos liberados por indicação', async () => {
    const titles = (await createDrizzleCosmeticCatalogRepository(db).listActive()).filter(
      (i) => i.unlockReferrals,
    )
    expect(titles.map((t) => [t.key, t.unlockReferrals])).toEqual([
      ['title_mensageiro', 5],
      ['title_embaixador', 20],
      ['title_patrono', 50],
    ])
  })

  it('código único: o segundo insert do mesmo código ou da mesma pessoa é recusado', async () => {
    const repo = createDrizzleReferralRepository(db)
    expect(await repo.insertCode(owner, 'ABCD2345')).toBe(true)
    expect(await repo.insertCode(friends[0], 'ABCD2345')).toBe(false)
    expect(await repo.insertCode(owner, 'EFGH6789')).toBe(false)
    expect(await repo.findUserByCode('ABCD2345')).toBe(owner)
    expect(await repo.findCodeByUser(owner)).toBe('ABCD2345')
  })

  it('uma conta indicada conta uma vez e a auto-indicação é barrada pela constraint', async () => {
    const repo = createDrizzleReferralRepository(db)
    expect(await repo.createReferral(owner, friends[0])).toBe(true)
    expect(await repo.createReferral(friends[1], friends[0])).toBe(false)
    expect(await repo.createReferral(owner, owner)).toBe(false)
    await expect(
      db.insert(schema.referrals).values({ referrerId: owner, referredId: owner }),
    ).rejects.toThrow()
  })

  it('qualify é condicional: só a primeira chamada valida', async () => {
    const repo = createDrizzleReferralRepository(db)
    await repo.createReferral(owner, friends[0])
    expect(await repo.qualify(friends[0], new Date())).toBe(owner)
    expect(await repo.qualify(friends[0], new Date())).toBeNull()
    expect(await repo.countQualified(owner)).toBe(1)
    expect(await repo.countPending(owner)).toBe(0)
  })

  it('cinco indicações concorrentes contam cinco vezes, uma por conta', async () => {
    const referrals = createDrizzleReferralRepository(db)
    await referrals.insertCode(owner, 'ABCD2345')
    const attribute = new AttributeReferralUseCase(referrals)
    const checks: string[] = []
    const qualify = new QualifyReferralUseCase(
      referrals,
      { check: async (id) => void checks.push(id) },
      () => new Date('2026-10-11T00:00:00Z'),
    )
    for (const friend of friends.slice(0, 5)) await attribute.execute(friend, 'ABCD2345')

    await Promise.all(friends.slice(0, 5).map((friend) => qualify.execute(friend)))
    await Promise.all(friends.slice(0, 5).map((friend) => qualify.execute(friend)))

    expect(await referrals.countQualified(owner)).toBe(5)
    expect(checks).toHaveLength(5)
  })
})
