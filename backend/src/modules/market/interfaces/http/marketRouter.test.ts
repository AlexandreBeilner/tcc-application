import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { EngineRequestError } from '../../domain/errors'
import { GetAssetQuotesUseCase } from '../../application/useCases/getAssetQuotes'
import { GetAssetUseCase } from '../../application/useCases/getAsset'
import { GetCompanyUseCase } from '../../application/useCases/getCompany'
import { GetMyAccountUseCase } from '../../application/useCases/getMyAccount'
import { ListAssetsUseCase } from '../../application/useCases/listAssets'
import { ListMyEventsUseCase } from '../../application/useCases/listMyEvents'
import { PlaceOrderUseCase } from '../../application/useCases/placeOrder'
import { PurchaseFixedIncomeUseCase } from '../../application/useCases/purchaseFixedIncome'
import { RedeemFixedIncomeUseCase } from '../../application/useCases/redeemFixedIncome'
import { SimulateFixedIncomeUseCase } from '../../application/useCases/simulateFixedIncome'
import { createFakeAccountReader } from '../../test/fakes/fakeAccountReader'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import { createMarketRouter } from './marketRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const catalogReader = createFakeCatalogReader({
    assets: [
      { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false },
    ],
    asset: { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false },
    quotes: [{ simulated_day: 1, price: 100 }],
    company: {
      id: 'company-1',
      name: 'Petrobras',
      cnpj: '1',
      sector: 'Energia',
      assets: [],
      fundamentals: [],
    },
  })
  const accountReader = createFakeAccountReader({
    account: {
      user_id: 'user-1',
      current_balance: 10000,
      total_invested: 0,
      total_dividends_received: 0,
    },
    positions: [],
    fixedIncomePositions: [],
    events: [{ id: 'event-1', event_type: 'initial_deposit', timestamp: '2026-01-01T00:00:00Z' }],
  })
  const orderExecutor = createFakeOrderExecutor({
    filled_quantity: 10,
    remaining_quantity: 0,
    fills: [],
  })
  const fixedIncomeExecutor = createFakeFixedIncomeExecutor({
    purchase: {
      unit_price: 950.2,
      quantity_purchased: 1.052,
      position: { quantity: 1.052, average_price: 950.2, average_rate: 0.11 },
    },
    redeem: {
      total_value: 1080,
      net_value: 1060,
      tax_rate: 0.175,
      mark_to_market: {
        mark_to_market_price: 1080,
        realized_return_pct: 0.08,
        vs_contracted_rate: -0.02,
      },
    },
    simulate: {
      unit_price: 798.27,
      quantity_purchased: 2.5,
      gross_projected_value: 2100,
      tax_rate: 0.2,
      net_projected_value: 2080,
    },
  })

  const app = express()
  app.use(express.json())
  app.use(
    createMarketRouter({
      listAssets: new ListAssetsUseCase(catalogReader),
      getAsset: new GetAssetUseCase(catalogReader),
      getAssetQuotes: new GetAssetQuotesUseCase(catalogReader),
      getCompany: new GetCompanyUseCase(catalogReader),
      getMyAccount: new GetMyAccountUseCase(accountReader),
      listMyEvents: new ListMyEventsUseCase(accountReader),
      placeOrder: new PlaceOrderUseCase(orderExecutor),
      purchaseFixedIncome: new PurchaseFixedIncomeUseCase(fixedIncomeExecutor),
      redeemFixedIncome: new RedeemFixedIncomeUseCase(fixedIncomeExecutor),
      simulateFixedIncome: new SimulateFixedIncomeUseCase(fixedIncomeExecutor),
      authMiddleware,
    }),
  )

  return { app, tokenIssuer, catalogReader, accountReader, orderExecutor, fixedIncomeExecutor }
}

describe('GET /market/assets', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/market/assets')
    expect(res.status).toBe(401)
  })

  it('retorna a lista do catálogo pra qualquer usuário autenticado', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/assets?type=acao')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.assets).toHaveLength(1)
  })

  it('retorna 400 pra type fora do enum', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/assets?type=invalido')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

describe('GET /market/assets/:id', () => {
  it('traduz um EngineRequestError (404) do CatalogReader 1:1 pro cliente', async () => {
    const { app, tokenIssuer, catalogReader } = buildApp()
    catalogReader.errorToThrow = new EngineRequestError(404, 'ativo não encontrado')
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/assets/inexistente')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'ativo não encontrado' })
  })
})

describe('GET /market/assets/:id/quotes', () => {
  it('retorna a série de cotações', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/assets/asset-1/quotes?days=7')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.quotes).toEqual([{ simulated_day: 1, price: 100 }])
  })
})

describe('GET /market/companies/:id', () => {
  it('retorna a empresa', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/companies/company-1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.company.name).toBe('Petrobras')
  })
})

describe('GET /market/me/account', () => {
  it('retorna a conta agregada do usuário do token, nunca de outro', async () => {
    const { app, tokenIssuer, accountReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/market/me/account').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ cashBalance: 10000, positions: [], fixedIncomePositions: [] })
    expect(accountReader.getAccountCalls).toEqual(['user-1'])
  })
})

describe('GET /market/me/events', () => {
  it('retorna o extrato paginado', async () => {
    const { app, tokenIssuer, accountReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/me/events?limit=10&offset=0')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(1)
    expect(accountReader.listAccountEventsCalls).toEqual([
      { userId: 'user-1', query: { limit: 10, offset: 0 } },
    ])
  })
})

describe('POST /market/orders', () => {
  it('injeta user_id do token, ignorando qualquer user_id enviado no corpo', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: 'outro-usuario',
        asset_id: '11111111-1111-4111-8111-111111111111',
        side: 'buy',
        type: 'market',
        quantity: 10,
      })

    expect(res.status).toBe(201)
    expect(orderExecutor.calls[0].user_id).toBe('user-1')
  })

  it('retorna 400 quando price ausente numa ordem limit', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        asset_id: '11111111-1111-4111-8111-111111111111',
        side: 'buy',
        type: 'limit',
        quantity: 10,
      })

    expect(res.status).toBe(400)
  })

  it('traduz 422 (saldo insuficiente) do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    orderExecutor.errorToThrow = new EngineRequestError(422, 'saldo insuficiente')
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        asset_id: '11111111-1111-4111-8111-111111111111',
        side: 'buy',
        type: 'market',
        quantity: 10,
      })

    expect(res.status).toBe(422)
    expect(res.body).toEqual({ error: 'saldo insuficiente' })
  })
})

describe('POST /market/fixed-income/purchases', () => {
  it('injeta user_id do token e retorna a posição resultante', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/fixed-income/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: 'outro-usuario',
        asset_id: '11111111-1111-4111-8111-111111111111',
        amount: 1000,
      })

    expect(res.status).toBe(201)
    expect(fixedIncomeExecutor.purchaseCalls[0].user_id).toBe('user-1')
  })
})

describe('POST /market/fixed-income/redemptions', () => {
  it('injeta user_id do token e retorna o valor resgatado', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/fixed-income/redemptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ asset_id: '11111111-1111-4111-8111-111111111111' })

    expect(res.status).toBe(200)
    expect(fixedIncomeExecutor.redeemCalls[0].user_id).toBe('user-1')
  })

  it('traduz 404 (sem posição) do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    fixedIncomeExecutor.errorToThrow = new EngineRequestError(
      404,
      'usuário sem posição nesse título',
    )
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/fixed-income/redemptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ asset_id: '11111111-1111-4111-8111-111111111111' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'usuário sem posição nesse título' })
  })
})

describe('GET /market/fixed-income/simulate', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get(
      '/market/fixed-income/simulate?asset_id=11111111-1111-4111-8111-111111111111&amount=2000&days_held=200',
    )
    expect(res.status).toBe(401)
  })

  it('repassa asset_id/amount/days_held pro FixedIncomeExecutor, sem exigir user_id', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get(
        '/market/fixed-income/simulate?asset_id=11111111-1111-4111-8111-111111111111&amount=2000&days_held=200',
      )
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      unit_price: 798.27,
      quantity_purchased: 2.5,
      gross_projected_value: 2100,
      tax_rate: 0.2,
      net_projected_value: 2080,
    })
    expect(fixedIncomeExecutor.simulateCalls).toEqual([
      { asset_id: '11111111-1111-4111-8111-111111111111', amount: 2000, days_held: 200 },
    ])
  })

  it('retorna 400 pra amount/days_held ausentes ou inválidos', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get(
        '/market/fixed-income/simulate?asset_id=11111111-1111-4111-8111-111111111111&amount=0&days_held=200',
      )
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('traduz 400 (ativo não é renda fixa) do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    fixedIncomeExecutor.errorToThrow = new EngineRequestError(
      400,
      'simulação só é suportada pra ativo de renda fixa',
    )
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get(
        '/market/fixed-income/simulate?asset_id=11111111-1111-4111-8111-111111111111&amount=2000&days_held=200',
      )
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'simulação só é suportada pra ativo de renda fixa' })
  })
})
