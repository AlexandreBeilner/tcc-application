import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleCosmeticCatalogRepository } from './drizzleCosmeticCatalogRepository'
import { createDrizzleCosmeticSelectionRepository } from './drizzleCosmeticSelectionRepository'

// Integração (MO.5.1): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// `user_cosmetics` e `users`). Prova o catálogo da migração e as constraints reais.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositórios de cosméticos (banco real)', () => {
  let pool: Pool
  let db: Database
  let userId: string
  let otherId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.userCosmetics)
    await db.delete(schema.subscriptions)
    await db.delete(schema.emailOutbox)
    await db.delete(schema.emailPreferences)
    await db.delete(schema.users)
    const rows = await db
      .insert(schema.users)
      .values([
        { name: 'Ana', username: 'ana', email: 'ana@exemplo.com', passwordHash: 'x' },
        { name: 'Beto', username: 'beto', email: 'beto@exemplo.com', passwordHash: 'x' },
      ])
      .returning({ id: schema.users.id })
    userId = rows[0].id
    otherId = rows[1].id
  })

  afterAll(async () => {
    await pool.end()
  })

  it('a migração entrega 6 molduras e 8 títulos ativos', async () => {
    const items = await createDrizzleCosmeticCatalogRepository(db).listActive()
    expect(items.filter((i) => i.kind === 'frame')).toHaveLength(6)
    expect(items.filter((i) => i.kind === 'title')).toHaveLength(8)
  })

  it('item desativado some da vitrine', async () => {
    await db.update(schema.cosmeticItems).set({ active: false }).where(eqKey('frame_coral'))
    const items = await createDrizzleCosmeticCatalogRepository(db).listActive()
    expect(items.map((i) => i.key)).not.toContain('frame_coral')
    await db.update(schema.cosmeticItems).set({ active: true }).where(eqKey('frame_coral'))
  })

  it('equip troca o item do mesmo espaço (um por tipo) e unequip tira só aquele', async () => {
    const repo = createDrizzleCosmeticSelectionRepository(db)
    await repo.equip(userId, 'frame', 'frame_aurora')
    await repo.equip(userId, 'title', 'title_paciente')
    await repo.equip(userId, 'frame', 'frame_oceano')

    expect(await repo.find(userId)).toEqual({ frame: 'frame_oceano', title: 'title_paciente' })
    expect(await db.select().from(schema.userCosmetics)).toHaveLength(2)

    await repo.unequip(userId, 'frame')
    expect(await repo.find(userId)).toEqual({ frame: null, title: 'title_paciente' })
  })

  it('findMany agrupa por usuário e omite quem não escolheu nada', async () => {
    const repo = createDrizzleCosmeticSelectionRepository(db)
    await repo.equip(userId, 'frame', 'frame_aurora')

    const map = await repo.findMany([userId, otherId])
    expect(map.get(userId)).toEqual({ frame: 'frame_aurora', title: null })
    expect(map.has(otherId)).toBe(false)
    expect((await repo.findMany([])).size).toBe(0)
  })

  it('rejeita item inexistente e tipo inválido (constraints)', async () => {
    const repo = createDrizzleCosmeticSelectionRepository(db)
    await expect(repo.equip(userId, 'frame', 'nao_existe')).rejects.toThrow()
    await expect(
      db.insert(schema.userCosmetics).values({ userId, kind: 'tema', itemKey: 'frame_aurora' }),
    ).rejects.toThrow()
  })
})

function eqKey(key: string) {
  return eq(schema.cosmeticItems.key, key)
}
