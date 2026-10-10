import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetSubscriptionStatusUseCase } from '../../application/useCases/getSubscriptionStatus'
import { HandleBillingWebhookUseCase } from '../../application/useCases/handleBillingWebhook'
import { GetBillingConversionUseCase } from '../../application/useCases/getBillingConversion'
import { RecordFunnelEventUseCase } from '../../application/useCases/recordFunnelEvent'
import { DevSubscriptionUseCase } from '../../application/useCases/devSubscription'
import { SyncSubscriptionUseCase } from '../../application/useCases/syncSubscription'
import { buildSubscription } from '../../domain/subscription'
import {
  createFakeBillingUserLookup,
  createFakeBillingWebhookEventLog,
  createFakeEntitlementProvider,
  createFakeBillingMailer,
  createFakeFunnelRecorder,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, entitlement } from '../../test/fixtures'
import { createBillingRouter } from './billingRouter'

const PRO_USER = '11111111-1111-4111-8111-111111111111'
const FREE_USER = '22222222-2222-4222-8222-222222222222'
const SECRET = 'Bearer segredo'
const EMPTY_STEPS = {
  lessonCompleted: 0,
  inviteViewed: 0,
  plansOpened: 0,
  purchaseStarted: 0,
  subscribed: 0,
  cancelled: 0,
}

function buildApp(options: { webhookEnabled?: boolean; devEnabled?: boolean } = {}) {
  const { webhookEnabled = true, devEnabled = false } = options
  const repo = createFakeSubscriptionRepository([
    buildSubscription(
      PRO_USER,
      entitlement({ store: 'play_store', managementUrl: 'https://m' }),
      NOW,
      null,
    ),
  ])
  const cache = createFakeSubscriptionCache()
  const provider = createFakeEntitlementProvider({ [FREE_USER]: entitlement({ store: 'stripe' }) })
  const funnel = createFakeFunnelRecorder()
  const sync = new SyncSubscriptionUseCase(
    provider,
    repo,
    cache,
    createFakeBillingMailer(),
    funnel,
    () => NOW,
  )
  const handle = new HandleBillingWebhookUseCase(
    createFakeBillingWebhookEventLog(),
    createFakeBillingUserLookup([PRO_USER, FREE_USER]),
    sync,
    () => NOW,
  )
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createBillingRouter({
      getSubscriptionStatus: new GetSubscriptionStatusUseCase(repo, cache, () => NOW),
      authMiddleware: createAuthMiddleware(tokenIssuer),
      recordFunnelEvent: new RecordFunnelEventUseCase(funnel, () => NOW),
      getBillingConversion: new GetBillingConversionUseCase(
        repo,
        { summarize: async () => ({ steps: EMPTY_STEPS, bySource: [] }) },
        { monthlyCents: 1990, annualCents: 19990 },
        () => NOW,
      ),
      dev: devEnabled ? new DevSubscriptionUseCase(repo, cache, funnel, () => NOW) : undefined,
      webhook: webhookEnabled ? { handle, isAuthorized: (h) => h === SECRET } : undefined,
    }),
  )
  return { app, tokenIssuer, repo, provider, funnel }
}

describe('GET /billing/status', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    expect((await request(buildApp().app).get('/billing/status')).status).toBe(401)
  })

  it('PRO: devolve o plano, a loja e o destino de gerenciar', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: PRO_USER, role: 'user' })

    const res = await request(app).get('/billing/status').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      isPro: true,
      state: 'active',
      plan: 'monthly',
      store: 'play_store',
      managementUrl: 'https://m',
      billingEnabled: true,
    })
  })

  it('free: isPro falso e sem dado de cobrança', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: FREE_USER, role: 'user' })

    const res = await request(app).get('/billing/status').set('Authorization', `Bearer ${token}`)

    expect(res.body).toEqual({
      isPro: false,
      state: 'none',
      plan: null,
      store: null,
      expiresAt: null,
      willRenew: false,
      managementUrl: null,
      billingEnabled: true,
    })
  })

  it('cobrança desligada: billingEnabled falso (o frontend esconde a compra)', async () => {
    const { app, tokenIssuer } = buildApp({ webhookEnabled: false })
    const token = tokenIssuer.issue({ sub: FREE_USER, role: 'user' })

    const res = await request(app).get('/billing/status').set('Authorization', `Bearer ${token}`)

    expect(res.body.billingEnabled).toBe(false)
  })
})

describe('POST /billing/webhook', () => {
  const body = (overrides: Record<string, unknown> = {}) => ({
    api_version: '1.0',
    event: {
      id: 'evt-1',
      type: 'INITIAL_PURCHASE',
      event_timestamp_ms: NOW.getTime(),
      app_user_id: FREE_USER,
      original_app_user_id: FREE_USER,
      aliases: [FREE_USER, '$RCAnonymousID:xyz'],
      ...overrides,
    },
  })

  it('401 sem o cabeçalho de autorização, sem processar', async () => {
    const { app, repo } = buildApp()
    const res = await request(app).post('/billing/webhook').send(body())
    expect(res.status).toBe(401)
    expect(repo.rows.has(FREE_USER)).toBe(false)
  })

  it('401 com cabeçalho errado', async () => {
    const { app } = buildApp()
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', 'Bearer errado')
      .send(body())
    expect(res.status).toBe(401)
  })

  it('compra: 200, reconsulta o provedor e a pessoa passa a ser PRO', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send(body())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true, outcome: 'synced' })

    const token = tokenIssuer.issue({ sub: FREE_USER, role: 'user' })
    const status = await request(app).get('/billing/status').set('Authorization', `Bearer ${token}`)
    expect(status.body.isPro).toBe(true)
  })

  it('o mesmo evento de novo responde 200 como duplicado', async () => {
    const { app } = buildApp()
    await request(app).post('/billing/webhook').set('Authorization', SECRET).send(body())
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send(body())
    expect(res.status).toBe(200)
    expect(res.body.outcome).toBe('duplicate')
  })

  it('evento que não interessa (TEST) responde 200', async () => {
    const { app } = buildApp()
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send(body({ type: 'TEST' }))
    expect(res.status).toBe(200)
    expect(res.body.outcome).toBe('ignored')
  })

  it('corpo fora do formato: 400', async () => {
    const { app } = buildApp()
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send({ foo: 1 })
    expect(res.status).toBe(400)
  })

  it('provedor fora do ar: 500, pro RevenueCat reenviar', async () => {
    const { app, provider } = buildApp()
    provider.failWith = new Error('RevenueCat caiu')
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send(body())
    expect(res.status).toBe(500)
  })

  it('cobrança desligada: 503', async () => {
    const { app } = buildApp({ webhookEnabled: false })
    const res = await request(app)
      .post('/billing/webhook')
      .set('Authorization', SECRET)
      .send(body())
    expect(res.status).toBe(503)
  })
})

describe('rotas de compra falsa (/billing/dev/*)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  const auth = (tokenIssuer: ReturnType<typeof buildApp>['tokenIssuer']) =>
    `Bearer ${tokenIssuer.issue({ sub: FREE_USER, role: 'user' })}`

  it('fora do modo dev as rotas não existem', async () => {
    const { app, tokenIssuer } = buildApp()
    const res = await request(app)
      .post('/billing/dev/purchase')
      .set('Authorization', auth(tokenIssuer))
      .send({ plan: 'monthly', store: 'play_store' })
    expect(res.status).toBe(404)
  })

  it('401 sem token', async () => {
    const { app } = buildApp({ devEnabled: true, webhookEnabled: false })
    const res = await request(app).post('/billing/dev/purchase').send({ plan: 'monthly', store: 'play_store' })
    expect(res.status).toBe(401)
  })

  it('400 com plano ou loja fora do contrato', async () => {
    const { app, tokenIssuer } = buildApp({ devEnabled: true, webhookEnabled: false })
    for (const body of [{ plan: 'weekly', store: 'play_store' }, { plan: 'monthly', store: 'stripe' }, {}]) {
      const res = await request(app).post('/billing/dev/purchase').set('Authorization', auth(tokenIssuer)).send(body)
      expect(res.status).toBe(400)
    }
  })

  it('compra vira PRO em /billing/status (billingEnabled true só com dev) e cancelar volta a free', async () => {
    const { app, tokenIssuer } = buildApp({ devEnabled: true, webhookEnabled: false })
    const header = auth(tokenIssuer)

    const bought = await request(app).post('/billing/dev/purchase').set('Authorization', header).send({ plan: 'annual', store: 'app_store' })
    expect(bought.status).toBe(204)
    const pro = await request(app).get('/billing/status').set('Authorization', header)
    expect(pro.body).toMatchObject({ isPro: true, plan: 'annual', store: 'app_store', billingEnabled: true })

    const cancelled = await request(app).delete('/billing/dev/subscription').set('Authorization', header)
    expect(cancelled.status).toBe(204)
  })
})

describe('POST /billing/funnel', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })
  const auth = (tokenIssuer: ReturnType<typeof buildApp>['tokenIssuer']) =>
    `Bearer ${tokenIssuer.issue({ sub: FREE_USER, role: 'user' })}`

  it('401 sem token', async () => {
    const res = await request(buildApp().app).post('/billing/funnel').send({ event: 'plans_opened' })
    expect(res.status).toBe(401)
  })

  it('204 e grava o evento da própria pessoa', async () => {
    const { app, tokenIssuer, funnel } = buildApp()
    const res = await request(app)
      .post('/billing/funnel')
      .set('Authorization', auth(tokenIssuer))
      .send({ event: 'invite_viewed', source: 'duel' })

    expect(res.status).toBe(204)
    expect(funnel.events).toMatchObject([{ userId: FREE_USER, name: 'invite_viewed', source: 'duel' }])
  })

  it('400 para evento que só o servidor grava, origem ou plano desconhecidos', async () => {
    const { app, tokenIssuer, funnel } = buildApp()
    for (const body of [{ event: 'subscribed' }, { event: 'plans_opened', source: 'x' }, { event: 'purchase_started', plan: 'weekly' }, {}]) {
      const res = await request(app).post('/billing/funnel').set('Authorization', auth(tokenIssuer)).send(body)
      expect(res.status).toBe(400)
    }
    expect(funnel.events).toHaveLength(0)
  })
})

describe('GET /admin/billing/conversion', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token e 403 para quem não é admin', async () => {
    const { app, tokenIssuer } = buildApp()
    expect((await request(app).get('/admin/billing/conversion')).status).toBe(401)
    const user = tokenIssuer.issue({ sub: FREE_USER, role: 'user' })
    const res = await request(app).get('/admin/billing/conversion').set('Authorization', `Bearer ${user}`)
    expect(res.status).toBe(403)
  })

  it('admin recebe as métricas, com 30 dias por padrão', async () => {
    const { app, tokenIssuer } = buildApp()
    const admin = tokenIssuer.issue({ sub: FREE_USER, role: 'admin' })

    const res = await request(app).get('/admin/billing/conversion').set('Authorization', `Bearer ${admin}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      windowDays: 30,
      subscribers: { active: 1, monthly: 1, annual: 0, unknown: 0 },
      recurringRevenueCents: 1990,
    })
  })

  it('400 para janela fora de 7, 30 ou 90', async () => {
    const { app, tokenIssuer } = buildApp()
    const admin = tokenIssuer.issue({ sub: FREE_USER, role: 'admin' })
    const res = await request(app).get('/admin/billing/conversion?days=5').set('Authorization', `Bearer ${admin}`)
    expect(res.status).toBe(400)
    const ok = await request(app).get('/admin/billing/conversion?days=7').set('Authorization', `Bearer ${admin}`)
    expect(ok.body.windowDays).toBe(7)
  })
})
