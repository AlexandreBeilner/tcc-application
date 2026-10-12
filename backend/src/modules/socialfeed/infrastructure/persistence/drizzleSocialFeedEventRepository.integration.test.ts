import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleSocialFeedEventRepository } from './drizzleSocialFeedEventRepository'

// Integração (MO.6.7): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (cria e
// apaga os próprios usuários). Prova que a participação em assembleia é gravada uma vez só por
// assembleia e pessoa, e que lê de volta com o desfecho.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('feed social: participação em assembleia (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    const suffix = randomUUID().slice(0, 8)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'bia'].map((u) => ({
          name: u,
          username: `${u}-${suffix}`,
          email: `${u}-${suffix}@exemplo.com`,
          passwordHash: 'x',
        })),
      )
      .returning({ id: schema.users.id })
    ids = rows.map((r) => r.id)
  })

  afterAll(async () => {
    if (ids?.length) {
      await db.delete(schema.socialFeedEvents).where(inArray(schema.socialFeedEvents.userId, ids))
      await db.delete(schema.users).where(inArray(schema.users.id, ids))
    }
    await pool.end()
  })

  const data = (assemblyId: string) => ({
    assemblyId,
    subjectLabel: 'Acme',
    title: 'Orçamento',
    outcome: 'approved' as const,
  })

  it('grava uma linha por assembleia e pessoa, mesmo repetindo', async () => {
    const repo = createDrizzleSocialFeedEventRepository(db)
    await repo.recordAssemblyParticipation(ids[0], data('asm-1'))
    await repo.recordAssemblyParticipation(ids[0], data('asm-1'))
    await repo.recordAssemblyParticipation(ids[1], data('asm-1'))
    await repo.recordAssemblyParticipation(ids[0], data('asm-2'))

    const events = await repo.listForUsers(ids, 20)
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.type === 'assembly_participated')).toBe(true)
  })

  it('lê de volta a pauta e o desfecho, sem nenhum campo de voto', async () => {
    const repo = createDrizzleSocialFeedEventRepository(db)
    await repo.recordAssemblyParticipation(ids[0], data('asm-9'))

    const [event] = await repo.listForUsers([ids[0]], 5)
    expect(event.data).toEqual(data('asm-9'))
    expect(event.trackNumber).toBeNull()
  })
})
