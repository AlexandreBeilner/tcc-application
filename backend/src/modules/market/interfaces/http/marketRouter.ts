import type { Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { translateEngineError } from './engineErrorTranslator'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import { EngineRequestError, ProductLockedError } from '../../domain/errors'
import type { GetAssetBookUseCase } from '../../application/useCases/getAssetBook'
import type { GetAssetQuotesUseCase } from '../../application/useCases/getAssetQuotes'
import type { GetAssetUseCase } from '../../application/useCases/getAsset'
import type { GetCompanyUseCase } from '../../application/useCases/getCompany'
import type { GetMyAccountUseCase } from '../../application/useCases/getMyAccount'
import type { ListAssetsUseCase } from '../../application/useCases/listAssets'
import type { ListMyEventsUseCase } from '../../application/useCases/listMyEvents'
import type { CancelOrderUseCase } from '../../application/useCases/cancelOrder'
import type { ListMyOrdersUseCase } from '../../application/useCases/listMyOrders'
import type { PlaceOrderUseCase } from '../../application/useCases/placeOrder'
import type { PurchaseFixedIncomeUseCase } from '../../application/useCases/purchaseFixedIncome'
import type { RedeemFixedIncomeUseCase } from '../../application/useCases/redeemFixedIncome'
import type { SimulateFixedIncomeUseCase } from '../../application/useCases/simulateFixedIncome'
import type { GetFixedIncomeTaxRateUseCase } from '../../application/useCases/getFixedIncomeTaxRate'
import type { GetIndicatorHistoryUseCase } from '../../application/useCases/getIndicatorHistory'
import type { GetMarketCalendarUseCase } from '../../application/useCases/getMarketCalendar'
import type { GetMarketClockUseCase } from '../../application/useCases/getMarketClock'
import type { GetTradingHaltsUseCase } from '../../application/useCases/getTradingHalts'
import {
  fixedIncomeTaxRateQuerySchema,
  getAssetQuotesQuerySchema,
  indicatorHistoryQuerySchema,
  listAssetsQuerySchema,
  listMyEventsQuerySchema,
  marketCalendarQuerySchema,
  placeOrderBodySchema,
  purchaseFixedIncomeBodySchema,
  redeemFixedIncomeBodySchema,
  simulateFixedIncomeQuerySchema,
} from './schemas'

export interface MarketRouterDeps {
  listAssets: ListAssetsUseCase
  getAsset: GetAssetUseCase
  getAssetQuotes: GetAssetQuotesUseCase
  getAssetBook: GetAssetBookUseCase
  getCompany: GetCompanyUseCase
  getMyAccount: GetMyAccountUseCase
  listMyEvents: ListMyEventsUseCase
  placeOrder: PlaceOrderUseCase
  cancelOrder: CancelOrderUseCase
  listMyOrders: ListMyOrdersUseCase
  purchaseFixedIncome: PurchaseFixedIncomeUseCase
  redeemFixedIncome: RedeemFixedIncomeUseCase
  simulateFixedIncome: SimulateFixedIncomeUseCase
  getFixedIncomeTaxRate: GetFixedIncomeTaxRateUseCase
  getIndicatorHistory: GetIndicatorHistoryUseCase
  getMarketClock: GetMarketClockUseCase
  getMarketCalendar: GetMarketCalendarUseCase
  getTradingHalts: GetTradingHaltsUseCase
  authMiddleware: AuthMiddleware
}

// `market` não tem regra de negócio própria além do gate de desbloqueio
// (`ProductLockedError`, tarefa 7.0.1) — o resto vive no engine/, que já
// devolve o status/mensagem certos (400/404/422/503). Este helper só evita
// repetir o mesmo bloco try/catch nas rotas (tarefa 6.0.3).
function sendEngineError(err: unknown, res: Response): void {
  if (err instanceof ProductLockedError) {
    res.status(err.status).json({
      error: err.message,
      key: err.key,
      unlockingLesson: err.unlockingLesson ?? null,
    })
    return
  }
  if (err instanceof EngineRequestError) {
    const translated = translateEngineError(err)
    res.status(translated.status).json(translated.body)
    return
  }
  throw err
}

export function createMarketRouter(deps: MarketRouterDeps): Router {
  const router = Router()
  router.param('id', requireUuidParam)

  // --- Catálogo (leitura, qualquer usuário autenticado) ---

  router.get('/market/assets', deps.authMiddleware.authenticate, async (req, res) => {
    const parsed = listAssetsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const assets = await deps.listAssets.execute({
        type: parsed.data.type,
        includeSandbox: parsed.data.include_sandbox,
      })
      res.status(200).json({ assets })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  router.get('/market/assets/:id', deps.authMiddleware.authenticate, async (req, res) => {
    try {
      const asset = await deps.getAsset.execute({ id: req.params.id as string })
      res.status(200).json({ asset })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  router.get('/market/assets/:id/quotes', deps.authMiddleware.authenticate, async (req, res) => {
    const parsed = getAssetQuotesQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const quotes = await deps.getAssetQuotes.execute({
        id: req.params.id as string,
        days: parsed.data.days,
      })
      res.status(200).json({ quotes })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  router.get('/market/companies/:id', deps.authMiddleware.authenticate, async (req, res) => {
    try {
      const company = await deps.getCompany.execute({ id: req.params.id as string })
      res.status(200).json({ company })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Melhor bid/ask e profundidade resumida do book (tarefa S.5) — o
  // backend sempre injeta o userId do token (nunca um id vindo da
  // requisição, mesmo padrão de GET /market/calendar): sandbox usa isso
  // pra resolver o dia do roteiro específico do usuário.
  router.get('/market/assets/:id/book', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const book = await deps.getAssetBook.execute({
        id: req.params.id as string,
        userId: req.auth.userId,
      })
      res.status(200).json({ book })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Proxy com cache Redis (tarefa M.3, composição em app.ts) pra
  // GET /market/indicators/history do motor (tarefa M.2) — série de
  // Selic/IPCA, qualquer usuário autenticado (sem regra de negócio própria
  // aqui, mesma convenção do resto da seção de catálogo).
  router.get('/market/indicators', deps.authMiddleware.authenticate, async (req, res) => {
    const parsed = indicatorHistoryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const indicators = await deps.getIndicatorHistory.execute({ days: parsed.data.days })
      res.status(200).json({ indicators })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Relógio e calendário do mercado simulado (tarefa S.10): proxy de
  // GET /market/clock e GET /market/calendar do motor. O calendário junta os
  // fatos do próprio usuário do token (nunca de outro) aos globais.
  router.get('/market/clock', deps.authMiddleware.authenticate, async (_req, res) => {
    try {
      const clock = await deps.getMarketClock.execute()
      res.status(200).json(clock)
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Pausa de negociação vigente (N.9): o usuário só vê se é global e em quais ativos.
  router.get('/market/halts', deps.authMiddleware.authenticate, async (_req, res) => {
    try {
      res.status(200).json(await deps.getTradingHalts.execute())
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  router.get('/market/calendar', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = marketCalendarQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const calendar = await deps.getMarketCalendar.execute({
        userId: req.auth.userId,
        from: parsed.data.from,
        to: parsed.data.to,
      })
      res.status(200).json(calendar)
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // --- Conta do próprio usuário (leitura) ---

  router.get('/market/me/account', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const account = await deps.getMyAccount.execute({ userId: req.auth.userId })
      res.status(200).json(account)
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  router.get('/market/me/events', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = listMyEventsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'parâmetros de paginação inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const events = await deps.listMyEvents.execute({
        userId: req.auth.userId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      })
      res.status(200).json({ events })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Lista as ordens do próprio usuário (tarefa O.3, achado 012) — leitura,
  // mas fica ao lado das rotas de ordem abaixo (mesmo recurso), não na
  // seção de catálogo acima. Sem paginação/filtro de status (escopo de
  // protótipo); o agrupamento em Pendentes/Executadas/Recusadas (O.4) é
  // responsabilidade do frontend.
  router.get('/market/orders', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const orders = await deps.listMyOrders.execute({ userId: req.auth.userId })
      res.status(200).json({ orders })
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // --- Escrita (execução real — RF01–RF03) ---

  router.post('/market/orders', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = placeOrderBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'dados de ordem inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      // user_id nunca vem do corpo do cliente — sempre o dono do token.
      const result = await deps.placeOrder.execute({ user_id: req.auth.userId, ...parsed.data })
      res.status(201).json(result)
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // Cancelamento manual de ordem pendente/parcial (tarefa O.1) —
  // user_id nunca vem do corpo/params do cliente, mesma convenção acima:
  // só o dono do token pode cancelar a própria ordem (o motor rejeita com
  // 404 se order_id pertencer a outro usuário).
  router.post('/market/orders/:id/cancel', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      await deps.cancelOrder.execute({
        order_id: req.params.id as string,
        user_id: req.auth.userId,
      })
      res.status(204).end()
    } catch (err) {
      sendEngineError(err, res)
    }
  })

  // GET, não POST — simulação sem efeito colateral (tarefa 6.0.5), por
  // isso fica antes da compra/resgate reais mas ainda dentro da seção de
  // renda fixa. Sem user_id: a projeção não depende de conta nem posição.
  router.get(
    '/market/fixed-income/simulate',
    deps.authMiddleware.authenticate,
    async (req, res) => {
      const parsed = simulateFixedIncomeQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'parâmetros de simulação inválidos',
          details: z.flattenError(parsed.error),
        })
        return
      }

      try {
        const result = await deps.simulateFixedIncome.execute(parsed.data)
        res.status(200).json(result)
      } catch (err) {
        sendEngineError(err, res)
      }
    },
  )

  // GET, sem asset_id/amount (tarefa 6.7) — sustenta o modo comparação da
  // Calculadora (6.2), que usa produtos hipotéticos digitados pelo
  // usuário, não um ativo real do catálogo (decisão (b) do backlog).
  router.get(
    '/market/fixed-income/tax-rate',
    deps.authMiddleware.authenticate,
    async (req, res) => {
      const parsed = fixedIncomeTaxRateQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'parâmetros inválidos',
          details: z.flattenError(parsed.error),
        })
        return
      }

      try {
        const result = await deps.getFixedIncomeTaxRate.execute(parsed.data)
        res.status(200).json(result)
      } catch (err) {
        sendEngineError(err, res)
      }
    },
  )

  router.post(
    '/market/fixed-income/purchases',
    deps.authMiddleware.authenticate,
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      const parsed = purchaseFixedIncomeBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'dados de aporte inválidos', details: z.flattenError(parsed.error) })
        return
      }

      try {
        const result = await deps.purchaseFixedIncome.execute({
          user_id: req.auth.userId,
          ...parsed.data,
        })
        res.status(201).json(result)
      } catch (err) {
        sendEngineError(err, res)
      }
    },
  )

  router.post(
    '/market/fixed-income/redemptions',
    deps.authMiddleware.authenticate,
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      const parsed = redeemFixedIncomeBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'dados de resgate inválidos', details: z.flattenError(parsed.error) })
        return
      }

      try {
        const result = await deps.redeemFixedIncome.execute({
          user_id: req.auth.userId,
          ...parsed.data,
        })
        res.status(200).json(result)
      } catch (err) {
        sendEngineError(err, res)
      }
    },
  )

  return router
}
