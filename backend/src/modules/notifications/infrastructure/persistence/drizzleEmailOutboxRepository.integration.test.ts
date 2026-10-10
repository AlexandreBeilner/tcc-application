import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleEmailOutboxRepository } from './drizzleEmailOutboxRepository'

// Teste de integração (EM.1.1): só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (apaga `email_outbox`). Cobre o que os fakes não provam: idempotência pela UNIQUE
// real e a reivindicação com `FOR UPDATE SKIP LOCKED` em conexões concorrentes.
const databaseUrl = process.env.TEST_DATABASE_URL

// `sendAt` fixo no passado: sem ele a linha nasce com o relógio do banco, que pode ser
// posterior ao `now` fixo que os testes passam pro worker.
const base = (key: string) => ({
  sendAt: new Date('2026-10-09T11:00:00Z'),
  userId: null,
  toAddress: 'ana@exemplo.com',
  templateKey: 'test',
  category: 'transactional' as const,
  payload: { key },
  idempotencyKey: key,
})

describe.skipIf(!databaseUrl)('drizzleEmailOutboxRepository (banco real)', () => {
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

  beforeEach(async () => {
    await db.delete(schema.emailOutbox)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('enqueue é idempotente pela chave', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)

    const first = await repo.enqueue(base('k1'))
    const second = await repo.enqueue({ ...base('k1'), payload: { outro: true } })

    expect(first.created).toBe(true)
    expect(second).toEqual({ id: first.id, created: false })
    const rows = await db.select().from(schema.emailOutbox)
    expect(rows).toHaveLength(1)
    expect(rows[0].payload).toEqual({ key: 'k1' })
  })

  it('claimBatch pega só pending vencida, incrementa tentativas e marca sending', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    await repo.enqueue(base('vencida'))
    await repo.enqueue({ ...base('futura'), sendAt: new Date('2026-10-09T13:00:00Z') })

    const batch = await repo.claimBatch(10, now)

    expect(batch.map((e) => e.idempotencyKey)).toEqual(['vencida'])
    expect(batch[0]).toMatchObject({ status: 'sending', attempts: 1 })
    expect(await repo.claimBatch(10, now)).toEqual([])
  })

  it('reivindicações concorrentes nunca pegam a mesma linha (SKIP LOCKED)', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    for (let i = 0; i < 30; i += 1) {
      await repo.enqueue(base(`c${i}`))
    }

    const claims = await Promise.all(Array.from({ length: 6 }, () => repo.claimBatch(10, now)))

    const ids = claims.flat().map((e) => e.id)
    expect(ids).toHaveLength(30)
    expect(new Set(ids).size).toBe(30)
  })

  it('markForRetry devolve pra pending, markSent e markFailed fecham a linha', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    const a = await repo.enqueue(base('a'))
    const b = await repo.enqueue(base('b'))
    const c = await repo.enqueue(base('c'))
    await repo.claimBatch(10, now)

    await repo.markForRetry(a.id, 'timeout', new Date('2026-10-09T12:01:00Z'))
    await repo.markSent(b.id, 'msg-1', now)
    await repo.markFailed(c.id, 'inválido')

    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.a).toMatchObject({ status: 'pending', lastError: 'timeout', attempts: 1 })
    expect(rows.b).toMatchObject({ status: 'sent', providerMessageId: 'msg-1' })
    expect(rows.b.sentAt).toEqual(now)
    expect(rows.c).toMatchObject({ status: 'failed', lastError: 'inválido' })
  })

  it('recoverStuck devolve sending antigo pra pending e falha o que esgotou tentativas', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const claimedAt = new Date('2026-10-09T12:00:00Z')
    await repo.enqueue(base('preso'))
    await repo.enqueue(base('esgotado'))
    await repo.claimBatch(10, claimedAt)
    await db
      .update(schema.emailOutbox)
      .set({ attempts: 5 })
      .where(eq(schema.emailOutbox.idempotencyKey, 'esgotado'))

    const tooSoon = await repo.recoverStuck(new Date('2026-10-09T11:59:00Z'), 5)
    const recovered = await repo.recoverStuck(new Date('2026-10-09T12:10:00Z'), 5)

    expect(tooSoon).toBe(0)
    expect(recovered).toBe(2)
    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.preso.status).toBe('pending')
    expect(rows.esgotado.status).toBe('failed')
  })
})
