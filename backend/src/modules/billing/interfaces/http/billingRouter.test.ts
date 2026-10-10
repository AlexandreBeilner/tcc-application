import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetSubscriptionStatusUseCase } from '../../application/useCases/getSubscriptionStatus'
import { HandleBillingWebhookUseCase } from '../../application/useCases/handleBillingWebhook'
import { SyncSubscriptionUseCase } from '../../application/useCases/syncSubscription'
import { buildSubscription } from '../../domain/subscription'
import {
  createFakeBillingUserLookup,
  createFakeBillingWebhookEventLog,
  createFakeEntitlementProvider,
  createFakeBillingMailer,
  createFakeSubscriptionCache,
  createFakeSubscriptionRepository,
} from '../../test/fakes/fakes'
import { NOW, entitlement } from '../../test/fixtures'
import { createBillingRouter } from './billingRouter'

const PRO_USER = '11111111-1111-4111-8111-111111111111'
const FREE_USER = '22222222-2222-4222-8222-222222222222'
const SECRET = 'Bearer segredo'

function buildApp(options: { webhookEnabled?: boolean } = {}) {
  const { webhookEnabled = true } = options
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
  const sync = new SyncSubscriptionUseCase(
    provider,
    repo,
    cache,
    createFakeBillingMailer(),
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
      webhook: webhookEnabled ? { handle, isAuthorized: (h) => h === SECRET } : undefined,
    }),
  )
  return { app, tokenIssuer, repo, provider }
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
