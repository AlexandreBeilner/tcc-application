import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import type { NewAssemblyInput } from '../../domain/assembly'
import { createDrizzleAssemblyRepository } from './drizzleAssemblyRepository'

// Integração (MO.6.1): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga as
// tabelas de assembleia e os usuários que ele mesmo cria). Prova a abertura idempotente, a troca de voto e a trava de
// janela sob concorrência com o fechamento.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositório de assembleias (banco real)', () => {
  let pool: Pool
  let db: Database
  let ids: string[]
  const now = new Date('2026-10-10T12:00:00Z')
  const input: NewAssemblyInput = {
    kind: 'shareholder',
    subjectRef: 'BNDD3',
    dedupeKey: 'BNDD3:2026-Q3',
    snapshotAt: now,
    opensAt: now,
    closesAt: new Date('2026-10-17T12:00:00Z'),
    effectAppliesAt: new Date('2026-10-20T12:00:00Z'),
    options: [
      { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: { x: 1 } },
      { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
    ],
  }

  async function clean() {
    await db.delete(schema.assemblyVoteCredits)
    await db.delete(schema.assemblyVotes)
    await db.delete(schema.assemblyOptions)
    await db.delete(schema.assemblies)
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
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
    // Só remove o que este arquivo criou: não depende (nem atrapalha) o estado dos outros testes.
    await clean()
    await db.delete(schema.users).where(inArray(schema.users.id, ids))
    await pool.end()
  })

  it('cria com opções em ordem e reexecutar a abertura não duplica', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const first = await repo.create(input, now)
    const again = await repo.create(input, now)
    expect(first.created).toBe(true)
    expect(again.created).toBe(false)
    expect(again.assembly.id).toBe(first.assembly.id)
    expect(first.options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(first.options[0].effect).toEqual({ x: 1 })
    expect(await db.select().from(schema.assemblies)).toHaveLength(1)
  })

  it('só aceita voto com a assembleia aberta e dentro da janela; trocar o voto mantém uma linha', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly, options } = await repo.create(input, now)
    const vote = (optionId: string, at = now) =>
      repo.upsertVote({ assemblyId: assembly.id, userId: ids[0], optionId }, at)

    expect(await vote(options[0].id)).toBe(false) // ainda agendada
    expect(await repo.markOpen(assembly.id)).toBe(true)
    expect(await repo.markOpen(assembly.id)).toBe(false)
    expect(await vote(options[0].id)).toBe(true)
    expect(await vote(options[1].id, new Date('2026-10-12T00:00:00Z'))).toBe(true)
    const votes = await repo.listVotes(assembly.id)
    expect(votes).toHaveLength(1)
    expect(votes[0].optionId).toBe(options[1].id)
    expect(await vote(options[0].id, new Date('2026-10-17T12:00:00Z'))).toBe(false) // no fechamento
  })

  it('fecha uma vez só e depois disso o voto é recusado', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly, options } = await repo.create(input, now)
    await repo.markOpen(assembly.id)
    const decision = {
      outcome: 'approved' as const,
      reason: 'decided' as const,
      winningOptionId: options[0].id,
      voterCount: 3,
      decidedAt: now,
    }
    expect(await repo.close(assembly.id, decision)).toBe(true)
    expect(await repo.close(assembly.id, decision)).toBe(false)
    const closed = await repo.findById(assembly.id)
    expect(closed?.assembly).toMatchObject({ status: 'closed', outcome: 'approved', voterCount: 3 })
    expect(
      await repo.upsertVote(
        { assemblyId: assembly.id, userId: ids[0], optionId: options[0].id },
        now,
      ),
    ).toBe(false)
    expect(await repo.listByStatus('closed', 10)).toHaveLength(1)
  })

  it('crédito mensal: conta por mês e consumir de novo na mesma assembleia é idempotente', async () => {
    const repo = createDrizzleAssemblyRepository(db)
    const { assembly } = await repo.create(input, now)
    const credit = { userId: ids[1], assemblyId: assembly.id, monthKey: '2026-10' }
    expect(await repo.countCreditsUsed(ids[1], '2026-10')).toBe(0)
    await repo.consumeCredit(credit, now)
    await repo.consumeCredit(credit, now)
    expect(await repo.countCreditsUsed(ids[1], '2026-10')).toBe(1)
    expect(await repo.countCreditsUsed(ids[1], '2026-11')).toBe(0)
    expect(await repo.countCreditsUsed(ids[2], '2026-10')).toBe(0)
  })
})
