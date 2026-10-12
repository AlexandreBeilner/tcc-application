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
import {
  createDrizzleFunnelReader,
  createDrizzleFunnelRecorder,
  createDrizzleFunnelRetention,
} from './drizzleFunnelEvents'
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
    await db.delete(schema.retrospectives)
    await db.delete(schema.dailyActivity)
    await db.delete(schema.duels)
    await db.delete(schema.leagueMembers)
    await db.delete(schema.leagues)
    await db.delete(schema.funnelEvents)
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

  describe('funil de conversão', () => {
    async function otherUser(username: string) {
      const [row] = await db
        .insert(schema.users)
        .values({ name: username, username, email: `${username}@exemplo.com`, passwordHash: 'x' })
        .returning({ id: schema.users.id })
      return row.id
    }
    const event = (
      user: string,
      name: 'invite_viewed' | 'plans_opened' | 'purchase_started' | 'subscribed' | 'cancelled',
      source: 'league' | 'duel' | null,
      key: string,
      at: Date,
    ) => ({ userId: user, name, source, plan: null, dedupeKey: key, at })

    it('gravar a mesma chave duas vezes não duplica nem falha', async () => {
      const recorder = createDrizzleFunnelRecorder(db)
      await recorder.record(event(userId, 'plans_opened', 'league', 'k1', NOW))
      await recorder.record(event(userId, 'plans_opened', 'league', 'k1', NOW))

      expect(await db.select().from(schema.funnelEvents)).toHaveLength(1)
    })

    it('a retenção apaga só o que é anterior ao corte (ponto 048)', async () => {
      const recorder = createDrizzleFunnelRecorder(db)
      await recorder.record(event(userId, 'plans_opened', 'league', 'old', day(-400)))
      await recorder.record(event(userId, 'plans_opened', 'duel', 'recent', NOW))

      const removed = await createDrizzleFunnelRetention(db).purgeOlderThan(day(-365))

      expect(removed).toBe(1)
      const left = await db.select().from(schema.funnelEvents)
      expect(left.map((row) => row.dedupeKey)).toEqual(['recent'])
    })

    it('listAll devolve todas as assinaturas', async () => {
      const repo = createDrizzleSubscriptionRepository(db)
      const other = await otherUser('bia')
      await repo.upsert(buildSubscription(userId, entitlement(), NOW, null))
      await repo.upsert(buildSubscription(other, entitlement({ store: 'play_store' }), NOW, null))

      expect((await repo.listAll()).map((s) => s.userId).sort()).toEqual([userId, other].sort())
    })

    it('resume pessoas distintas por passo e por ponto, e atribui "assinou" a quem teve contato antes', async () => {
      const recorder = createDrizzleFunnelRecorder(db)
      const reader = createDrizzleFunnelReader(db)
      const bia = await otherUser('bia')
      const caio = await otherUser('caio')

      // Ana: viu o convite da liga duas vezes (dias diferentes), abriu /planos e assinou depois.
      await recorder.record(event(userId, 'invite_viewed', 'league', 'a1', day(-5)))
      await recorder.record(event(userId, 'invite_viewed', 'league', 'a2', day(-4)))
      await recorder.record(event(userId, 'plans_opened', 'league', 'a3', day(-4)))
      await recorder.record(event(userId, 'subscribed', null, 'a4', day(-3)))
      // Bia: viu o convite do duelo e não assinou.
      await recorder.record(event(bia, 'invite_viewed', 'duel', 'b1', day(-2)))
      // Caio: assinou e cancelou, mas o contato com a liga foi DEPOIS de assinar (não conta).
      await recorder.record(event(caio, 'subscribed', null, 'c1', day(-6)))
      await recorder.record(event(caio, 'cancelled', null, 'c2', day(-1)))
      await recorder.record(event(caio, 'invite_viewed', 'league', 'c3', day(-1)))
      // Fora da janela de 7 dias.
      await recorder.record(event(bia, 'purchase_started', 'duel', 'b2', day(-20)))

      const summary = await reader.summarize(day(-7))

      expect(summary.steps).toMatchObject({
        inviteViewed: 3,
        plansOpened: 1,
        purchaseStarted: 0,
        subscribed: 2,
        cancelled: 1,
      })
      const league = summary.bySource.find((r) => r.source === 'league')
      expect(league).toEqual({
        source: 'league',
        reached: 2,
        inviteViewed: 2,
        plansOpened: 1,
        purchaseStarted: 0,
        subscribed: 1,
      })
      expect(summary.bySource.find((r) => r.source === 'duel')).toMatchObject({
        reached: 1,
        subscribed: 0,
      })
      expect(summary.bySource.map((r) => r.source)).toEqual([
        'league',
        'duel',
        'cosmetics',
        'retrospective',
        'assembly',
        'portfolio',
        'menu',
        'header',
        'direct',
      ])
    })

    it('sem nenhum evento devolve zeros e todos os pontos', async () => {
      const summary = await createDrizzleFunnelReader(db).summarize(day(-7))
      expect(summary.steps).toEqual({
        lessonCompleted: 0,
        inviteViewed: 0,
        plansOpened: 0,
        purchaseStarted: 0,
        subscribed: 0,
        cancelled: 0,
      })
      expect(summary.bySource).toHaveLength(9)
    })
  })
})
