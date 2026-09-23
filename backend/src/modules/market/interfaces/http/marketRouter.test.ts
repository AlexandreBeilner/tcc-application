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
import { CancelOrderUseCase } from '../../application/useCases/cancelOrder'
import { ListMyOrdersUseCase } from '../../application/useCases/listMyOrders'
import { PlaceOrderUseCase } from '../../application/useCases/placeOrder'
import { PurchaseFixedIncomeUseCase } from '../../application/useCases/purchaseFixedIncome'
import { RedeemFixedIncomeUseCase } from '../../application/useCases/redeemFixedIncome'
import { SimulateFixedIncomeUseCase } from '../../application/useCases/simulateFixedIncome'
import { GetFixedIncomeTaxRateUseCase } from '../../application/useCases/getFixedIncomeTaxRate'
import { GetIndicatorHistoryUseCase } from '../../application/useCases/getIndicatorHistory'
import { createFakeAccountReader } from '../../test/fakes/fakeAccountReader'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { createFakeIndicatorHistoryReader } from '../../test/fakes/fakeIndicatorHistoryReader'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import { createFakeProductUnlockReader } from '../../test/fakes/fakeProductUnlockReader'
import { createMarketRouter } from './marketRouter'

function buildApp(
  options: {
    unlockedAssetKeys?: Set<string>
    lessonHint?: { code: string; title: string }
    assetType?: string
  } = {},
) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const assetType = options.assetType ?? 'acao'

  const catalogReader = createFakeCatalogReader({
    assets: [
      { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: assetType, is_sandbox: false },
    ],
    asset: {
      id: 'asset-1',
      ticker: 'PETR4',
      name: 'Petrobras',
      type: assetType,
      is_sandbox: false,
    },
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
    order_id: 'order-1',
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
    getTaxRate: { tax_rate: 0.175 },
  })
  const indicatorHistoryReader = createFakeIndicatorHistoryReader({
    history: [
      { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
    ],
  })
  // Desbloqueado por padrão (`asset:acao`, o único tipo usado pelo
  // catalogReader fake acima) — os testes que não são sobre o gate da
  // 7.0.1 continuam exercitando só o caminho feliz; `productUnlockReader`
  // fica exposto pra quem precisar simular o produto travado.
  const productUnlockReader = createFakeProductUnlockReader({
    unlockedKeys: options.unlockedAssetKeys ?? new Set(['asset:acao']),
    lessonHint: options.lessonHint,
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
      placeOrder: new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader),
      cancelOrder: new CancelOrderUseCase(orderExecutor),
      listMyOrders: new ListMyOrdersUseCase(orderExecutor, catalogReader),
      purchaseFixedIncome: new PurchaseFixedIncomeUseCase(
        fixedIncomeExecutor,
        catalogReader,
        productUnlockReader,
      ),
      redeemFixedIncome: new RedeemFixedIncomeUseCase(fixedIncomeExecutor),
      simulateFixedIncome: new SimulateFixedIncomeUseCase(fixedIncomeExecutor),
      getFixedIncomeTaxRate: new GetFixedIncomeTaxRateUseCase(fixedIncomeExecutor),
      getIndicatorHistory: new GetIndicatorHistoryUseCase(indicatorHistoryReader),
      authMiddleware,
    }),
  )

  return {
    app,
    tokenIssuer,
    catalogReader,
    accountReader,
    orderExecutor,
    fixedIncomeExecutor,
    productUnlockReader,
    indicatorHistoryReader,
  }
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

describe('GET /market/indicators', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/market/indicators')
    expect(res.status).toBe(401)
  })

  it('retorna a série histórica de Selic/IPCA', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/indicators?days=30')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.indicators).toEqual([
      { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
    ])
  })

  it('repassa days pro reader, sem default próprio (motor decide)', async () => {
    const { app, tokenIssuer, indicatorHistoryReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    await request(app).get('/market/indicators?days=30').set('Authorization', `Bearer ${token}`)
    await request(app).get('/market/indicators').set('Authorization', `Bearer ${token}`)

    expect(indicatorHistoryReader.getIndicatorHistoryCalls).toEqual([30, undefined])
  })

  it('retorna 400 pra days inválido', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/indicators?days=0')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('traduz um EngineRequestError do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, indicatorHistoryReader } = buildApp()
    indicatorHistoryReader.errorToThrow = new EngineRequestError(503, 'motor indisponível')
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/market/indicators').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'motor indisponível' })
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

describe('GET /market/orders', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/market/orders')
    expect(res.status).toBe(401)
  })

  it('lista as ordens do usuário do token, enriquecidas com ticker/nome do ativo', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    orderExecutor.listResult = [
      {
        order_id: 'order-1',
        asset_id: 'asset-1',
        side: 'buy',
        type: 'market',
        quantity: 10,
        filled_quantity: 10,
        price: 25,
        status: 'filled',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/market/orders').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(orderExecutor.listCalls).toEqual(['user-1'])
    expect(res.body.orders).toEqual([
      {
        order_id: 'order-1',
        asset_id: 'asset-1',
        ticker: 'PETR4',
        name: 'Petrobras',
        side: 'buy',
        type: 'market',
        quantity: 10,
        filled_quantity: 10,
        price: 25,
        status: 'filled',
        created_at: '2026-01-01T00:00:00Z',
      },
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

  it('retorna 403 (produto travado pela trilha) quando o usuário não desbloqueou o tipo do ativo (tarefa 7.0.1)', async () => {
    const { app, tokenIssuer } = buildApp({
      unlockedAssetKeys: new Set(),
      lessonHint: { code: '2.3', title: 'Nomenclatura de tickers' },
    })
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

    expect(res.status).toBe(403)
    expect(res.body.key).toBe('asset:acao')
    expect(res.body.unlockingLesson).toEqual({ code: '2.3', title: 'Nomenclatura de tickers' })
  })
})

describe('POST /market/orders/:id/cancel', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).post('/market/orders/order-1/cancel')
    expect(res.status).toBe(401)
  })

  it('injeta user_id do token e devolve 204', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders/order-1/cancel')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
    expect(orderExecutor.cancelCalls).toEqual([{ orderId: 'order-1', userId: 'user-1' }])
  })

  it('traduz 404 (ordem não encontrada ou de outro usuário) do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    orderExecutor.errorToThrow = new EngineRequestError(404, 'ordem não encontrada')
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders/order-1/cancel')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'ordem não encontrada' })
  })

  it('traduz 409 (ordem já filled/cancelled) do motor 1:1 pro cliente', async () => {
    const { app, tokenIssuer, orderExecutor } = buildApp()
    orderExecutor.errorToThrow = new EngineRequestError(
      409,
      'ordem não pode ser cancelada neste status',
    )
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/orders/order-1/cancel')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'ordem não pode ser cancelada neste status' })
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

  it('retorna 403 (produto travado pela trilha) quando o usuário não desbloqueou o tipo do ativo (tarefa 7.0.1)', async () => {
    const { app, tokenIssuer } = buildApp({ unlockedAssetKeys: new Set(), assetType: 'cdb' })
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/market/fixed-income/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ asset_id: '11111111-1111-4111-8111-111111111111', amount: 1000 })

    expect(res.status).toBe(403)
    expect(res.body.key).toBe('asset:cdb')
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

describe('GET /market/fixed-income/tax-rate', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/market/fixed-income/tax-rate?days_held=400')
    expect(res.status).toBe(401)
  })

  it('repassa days_held pro FixedIncomeExecutor, sem exigir asset_id/amount/user_id', async () => {
    const { app, tokenIssuer, fixedIncomeExecutor } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/fixed-income/tax-rate?days_held=400')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tax_rate: 0.175 })
    expect(fixedIncomeExecutor.getTaxRateCalls).toEqual([{ days_held: 400 }])
  })

  it('retorna 400 pra days_held ausente ou inválido', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/market/fixed-income/tax-rate?days_held=0')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})
