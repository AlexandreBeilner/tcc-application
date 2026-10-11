import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import type { ProposeInput } from '../../application/ports/proposalRepository'
import { createDrizzleProposalRepository } from './drizzleProposalRepository'

// Integração (MO.6.5): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL. Prova a
// proposta única por pauta sob concorrência, o teto mensal sob concorrência, o apoio idempotente
// e a expiração. As pautas vêm do catálogo semeado pela migração 0043.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositório de propostas de pauta (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]
  let keys: string[]
  const now = new Date('2026-10-10T12:00:00Z')
  const DAY = 24 * 60 * 60 * 1000

  const input = (
    userId: string,
    templateKey: string,
    over: Partial<ProposeInput> = {},
  ): ProposeInput => ({
    kind: 'shareholder',
    subjectRef: 'company-1',
    templateKey,
    userId,
    now,
    expiresAt: new Date(now.getTime() + 30 * DAY),
    monthFrom: new Date('2026-10-01T03:00:00Z'),
    monthTo: new Date('2026-11-01T03:00:00Z'),
    monthlyCap: 3,
    ...over,
  })

  async function clean() {
    await db.delete(schema.agendaProposalSupports)
    await db.delete(schema.agendaProposals)
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
    keys = (await db.select({ key: schema.agendaTemplates.key }).from(schema.agendaTemplates)).map(
      (r) => r.key,
    )
  })

  beforeEach(async () => {
    await clean()
    const suffix = randomUUID().slice(0, 8)
    const rows = await db
      .insert(schema.users)
      .values(
        ['ana', 'bia', 'caio'].map((u) => ({
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
    await clean()
    await db.delete(schema.users).where(inArray(schema.users.id, ids))
    await pool.end()
  })

  it('cria com o proponente como primeiro apoio e conta o teto do mês', async () => {
    const repo = createDrizzleProposalRepository(db)
    const [ana] = ids
    const out = await repo.propose(input(ana, keys[0]))
    expect(out.status).toBe('created')
    if (out.status !== 'created') return
    expect(out.proposal).toMatchObject({ supportCount: 1, supportedByMe: true, status: 'active' })
    expect(await repo.countProposedBy(ana, input(ana, '').monthFrom, input(ana, '').monthTo)).toBe(
      1,
    )
    expect(
      await repo.countProposedBy(
        ana,
        new Date('2026-11-01T03:00:00Z'),
        new Date('2026-12-01T03:00:00Z'),
      ),
    ).toBe(0)
  })

  it('duas pessoas propondo a mesma pauta ao mesmo tempo: uma cria, a outra recebe a existente', async () => {
    const repo = createDrizzleProposalRepository(db)
    const results = await Promise.all([
      repo.propose(input(ids[0], keys[0])),
      repo.propose(input(ids[1], keys[0])),
    ])
    expect(results.map((r) => r.status).sort()).toEqual(['created', 'existing'])
    expect(await db.select().from(schema.agendaProposals)).toHaveLength(1)
  })

  it('teto mensal sob concorrência: nunca passa do limite', async () => {
    const repo = createDrizzleProposalRepository(db)
    const results = await Promise.all(
      keys.slice(0, 5).map((k) => repo.propose(input(ids[0], k, { monthlyCap: 2 }))),
    )
    expect(results.filter((r) => r.status === 'created')).toHaveLength(2)
    expect(results.filter((r) => r.status === 'cap_reached')).toHaveLength(3)
  })

  it('apoio é idempotente, vale só para proposta ativa e dentro do prazo, e retirar não apaga a proposta', async () => {
    const repo = createDrizzleProposalRepository(db)
    const out = await repo.propose(input(ids[0], keys[0]))
    if (out.status !== 'created') throw new Error('esperava criar')
    const id = out.proposal.id
    expect(await repo.addSupport(id, ids[1], now)).toBe('added')
    expect(await repo.addSupport(id, ids[1], now)).toBe('already')
    expect((await repo.findById(id, ids[1]))?.supportCount).toBe(2)
    expect((await repo.findById(id))?.supportedByMe).toBe(false)
    expect(await repo.removeSupport(id, ids[1])).toBe(true)
    expect(await repo.removeSupport(id, ids[1])).toBe(false)
    expect((await repo.findById(id, ids[0]))?.supportCount).toBe(1)
    expect(await repo.addSupport(id, ids[2], new Date(now.getTime() + 31 * DAY))).toBe('not_active')
    expect(await repo.addSupport(randomUUID(), ids[2], now)).toBe('not_active')
  })

  it('lista só as ativas e vivas, expira as vencidas e libera a pauta para nova proposta', async () => {
    const repo = createDrizzleProposalRepository(db)
    await repo.propose(input(ids[0], keys[0]))
    await repo.propose(input(ids[0], keys[1], { expiresAt: new Date(now.getTime() + 1 * DAY) }))
    const later = new Date(now.getTime() + 2 * DAY)
    expect(
      (await repo.listActive('shareholder', 'company-1', later)).map((p) => p.templateKey),
    ).toEqual([keys[0]])
    expect(await repo.expireDue(later)).toBe(1)
    expect(await repo.expireDue(later)).toBe(0)
    // A pauta vencida pode ser proposta de novo (é uma proposta nova, não a existente).
    const again = await repo.propose(
      input(ids[1], keys[1], { now: later, expiresAt: new Date(later.getTime() + 30 * DAY) }),
    )
    expect(again.status).toBe('created')
  })

  it('consumir marca a ativa daquela pauta, é idempotente e some da fila', async () => {
    const repo = createDrizzleProposalRepository(db)
    await repo.propose(input(ids[0], keys[0]))
    await repo.propose(input(ids[0], keys[1]))
    const { assembly } = await createAssembly()
    expect(await repo.consumeActive('shareholder', 'company-1', keys[0], assembly, now)).toBe(true)
    expect(await repo.consumeActive('shareholder', 'company-1', keys[0], assembly, now)).toBe(false)
    expect(
      (await repo.listActive('shareholder', 'company-1', now)).map((p) => p.templateKey),
    ).toEqual([keys[1]])
    await db.delete(schema.agendaProposals)
    await db.delete(schema.assemblies)
  })

  async function createAssembly() {
    const [row] = await db
      .insert(schema.assemblies)
      .values({
        kind: 'shareholder',
        subjectRef: 'company-1',
        dedupeKey: `t:${randomUUID()}`,
        status: 'open',
        opensAt: now,
        snapshotAt: now,
        closesAt: new Date(now.getTime() + 7 * DAY),
        effectAppliesAt: new Date(now.getTime() + 8 * DAY),
      })
      .returning({ id: schema.assemblies.id })
    return { assembly: row.id }
  }
})
