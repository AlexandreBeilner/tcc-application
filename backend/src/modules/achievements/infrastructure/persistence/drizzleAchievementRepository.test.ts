import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleAchievementRepository } from './drizzleAchievementRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava conquistas e usuários). Nunca o `gamification` de dev.
// Rode com `--no-file-parallelism` junto dos outros arquivos de integração.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleAchievementRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
  })

  afterAll(async () => {
    await pool.end()
  })

  async function newUser(label: string) {
    const [user] = await db
      .insert(schema.users)
      .values({
        name: label,
        email: `${label}-${suffix}@t.dev`,
        username: `${label}${suffix}`.slice(0, 30),
      })
      .returning()
    return user
  }

  it('cria ativa, sem seed_key, e devolve a meta como número', async () => {
    const repo = createDrizzleAchievementRepository(db)

    const created = await repo.create({
      name: `Teste ${suffix}`,
      description: null,
      criteriaType: 'net_worth',
      criteriaValue: 12000.5,
    })

    expect(created).toMatchObject({
      name: `Teste ${suffix}`,
      criteriaType: 'net_worth',
      criteriaValue: 12000.5,
      isActive: true,
    })
    const [row] = await db.select().from(schema.achievements)
    expect(row).toBeDefined()
    expect((await repo.findById(created.id))?.criteriaValue).toBe(12000.5)
  })

  it('edita só o que veio, desativa e reativa sem tocar o resto', async () => {
    const repo = createDrizzleAchievementRepository(db)
    const created = await repo.create({
      name: `Edita ${suffix}`,
      description: 'original',
      criteriaType: 'streak_days',
      criteriaValue: 7,
    })

    const renamed = await repo.update(created.id, { name: `Editada ${suffix}`, criteriaValue: 10 })
    const off = await repo.update(created.id, { isActive: false })
    const same = await repo.update(created.id, {})

    expect(renamed).toMatchObject({
      name: `Editada ${suffix}`,
      criteriaValue: 10,
      description: 'original',
    })
    expect(off).toMatchObject({ isActive: false, name: `Editada ${suffix}` })
    expect(same).toEqual(off)
    expect(
      await repo.update('00000000-0000-4000-8000-000000000000', { isActive: false }),
    ).toBeUndefined()
  })

  it('conta quantos usuários têm cada conquista, e desativar não apaga ninguém', async () => {
    const repo = createDrizzleAchievementRepository(db)
    const created = await repo.create({
      name: `Conta ${suffix}`,
      description: null,
      criteriaType: 'lessons_completed',
      criteriaValue: 3,
    })
    const [a, b] = await Promise.all([newUser('contaa'), newUser('contab')])
    await repo.unlock(a.id, created.id)
    await repo.unlock(b.id, created.id)
    await repo.unlock(b.id, created.id)

    await repo.update(created.id, { isActive: false })

    expect((await repo.countUnlockedByAchievement()).get(created.id)).toBe(2)
    expect((await repo.listUnlockedForUser(a.id)).map((u) => u.achievementId)).toEqual([created.id])
    expect((await repo.listCatalog()).find((x) => x.id === created.id)?.isActive).toBe(false)
  })

  it('a migration 0021 deixou todas as conquistas existentes ativas', async () => {
    const repo = createDrizzleAchievementRepository(db)
    const seeded = await db
      .insert(schema.achievements)
      .values({
        name: `Seed ${suffix}`,
        criteriaType: 'trades_executed',
        criteriaValue: '1',
        seedKey: `seed_${suffix}`,
      })
      .returning()

    expect((await repo.findById(seeded[0].id))?.isActive).toBe(true)
  })
})
