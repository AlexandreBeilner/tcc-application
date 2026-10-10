import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { buildSubscription } from '../../domain/subscription'
import { entitlement, NOW, day } from '../../test/fixtures'
import { createDrizzleBillingUserLookup } from './drizzleBillingUserLookup'
import { createDrizzleReconciliationAudience } from './drizzleReconciliationAudience'
import { createDrizzleBillingWebhookEventLog } from './drizzleBillingWebhookEventLog'
import { createDrizzleSubscriptionRepository } from './drizzleSubscriptionRepository'

// Integração (MO.2.1): só roda com TEST_DATABASE_URL apontando pra um banco DESCARTÁVEL (apaga
// `subscriptions`, `billing_webhook_events` e `users`). Prova o que os fakes não provam: as
// constraints e o upsert reais.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('repositórios de cobrança (banco real)', () => {
  let pool: Pool
  let db: Database
  let userId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 4 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.leagueMembers)
    await db.delete(schema.leagues)
    await db.delete(schema.subscriptions)
    await db.delete(schema.billingWebhookEvents)
    await db.delete(schema.emailOutbox)
    await db.delete(schema.emailPreferences)
    await db.delete(schema.users)
    const [user] = await db
      .insert(schema.users)
      .values({
        name: 'Ana',
        username: 'ana',
        email: 'ana@exemplo.com',
        passwordHash: 'x',
      })
      .returning({ id: schema.users.id })
    userId = user.id
  })

  afterAll(async () => {
    await pool.end()
  })

  it('upsert grava e find devolve a assinatura com as datas', async () => {
    const repo = createDrizzleSubscriptionRepository(db)
    const sub = buildSubscription(userId, entitlement({ store: 'app_store' }), NOW, day(-1))

    await repo.upsert(sub)

    expect(await repo.find(userId)).toEqual(sub)
  })

  it('findMany devolve só as assinaturas dos ids pedidos (e lista vazia não consulta)', async () => {
    const repo = createDrizzleSubscriptionRepository(db)
    await repo.upsert(buildSubscription(userId, entitlement(), NOW, null))

    expect(await repo.findMany([])).toEqual([])
    expect(await repo.findMany(['00000000-0000-4000-8000-000000000000'])).toEqual([])
    const found = await repo.findMany([userId])
    expect(found.map((s) => s.userId)).toEqual([userId])
  })

  it('upsert de novo substitui a linha (uma por usuário)', async () => {
    const repo = createDrizzleSubscriptionRepository(db)
    await repo.upsert(
      buildSubscription(userId, entitlement({ productId: 'pro_monthly' }), NOW, null),
    )
    await repo.upsert(
      buildSubscription(
        userId,
        entitlement({ productId: 'pro_annual', expiresAt: day(365) }),
        NOW,
        null,
      ),
    )

    const rows = await db.select().from(schema.subscriptions)
    expect(rows).toHaveLength(1)
    expect((await repo.find(userId))?.productId).toBe('pro_annual')
  })

  it('aceita vencimento nulo (concessão promocional vitalícia)', async () => {
    const repo = createDrizzleSubscriptionRepository(db)
    await repo.upsert(
      buildSubscription(userId, entitlement({ store: 'promotional', expiresAt: null }), NOW, null),
    )
    expect((await repo.find(userId))?.expiresAt).toBeNull()
  })

  it('find de quem nunca assinou devolve null', async () => {
    expect(await createDrizzleSubscriptionRepository(db).find(userId)).toBeNull()
  })

  it('a constraint recusa loja desconhecida', async () => {
    await expect(
      db.insert(schema.subscriptions).values({
        userId,
        store: 'bitcoin',
        productId: 'x',
        period: 'unknown',
      }),
    ).rejects.toThrow()
  })

  it('registro de evento é idempotente', async () => {
    const log = createDrizzleBillingWebhookEventLog(db)
    expect(await log.wasProcessed('evt-1')).toBe(false)
    await log.record('evt-1', 'RENEWAL', NOW)
    await log.record('evt-1', 'RENEWAL', NOW)
    expect(await log.wasProcessed('evt-1')).toBe(true)
  })

  it('lookup devolve só ids que são usuários', async () => {
    const lookup = createDrizzleBillingUserLookup(db)
    const stranger = '33333333-3333-4333-8333-333333333333'
    expect(await lookup.existingUserIds([userId, stranger])).toEqual([userId])
    expect(await lookup.existingUserIds([])).toEqual([])
  })

  it('audience de reconciliação: só projeção velha e ainda relevante, mais antigas primeiro', async () => {
    const repo = createDrizzleSubscriptionRepository(db)
    const audience = createDrizzleReconciliationAudience(db)
    const mk = async (username: string) => {
      const [u] = await db
        .insert(schema.users)
        .values({ name: username, username, email: `${username}@exemplo.com`, passwordHash: 'x' })
        .returning({ id: schema.users.id })
      return u.id
    }
    const staleActive = await mk('velha')
    const stale2 = await mk('velha2')
    const fresh = await mk('fresca')
    const longExpired = await mk('vencida')

    const at = (id: string, updatedAt: Date, expiresAt: Date | null) =>
      repo.upsert({
        ...buildSubscription(id, entitlement({ expiresAt }), updatedAt, null),
        updatedAt,
      })
    await at(staleActive, day(-2), day(10))
    await at(stale2, day(-3), null)
    await at(fresh, day(0), day(10))
    await at(longExpired, day(-30), day(-20))

    const ids = await audience.findStale({
      staleBefore: day(-1),
      relevantSince: day(-3),
      limit: 10,
    })

    expect(ids).toEqual([stale2, staleActive])
  })
})
