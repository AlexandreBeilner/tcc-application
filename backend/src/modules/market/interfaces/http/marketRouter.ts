import type { Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { EngineRequestError } from '../../domain/errors'
import type { GetAssetQuotesUseCase } from '../../application/useCases/getAssetQuotes'
import type { GetAssetUseCase } from '../../application/useCases/getAsset'
import type { GetCompanyUseCase } from '../../application/useCases/getCompany'
import type { GetMyAccountUseCase } from '../../application/useCases/getMyAccount'
import type { ListAssetsUseCase } from '../../application/useCases/listAssets'
import type { ListMyEventsUseCase } from '../../application/useCases/listMyEvents'
import type { PlaceOrderUseCase } from '../../application/useCases/placeOrder'
import type { PurchaseFixedIncomeUseCase } from '../../application/useCases/purchaseFixedIncome'
import type { RedeemFixedIncomeUseCase } from '../../application/useCases/redeemFixedIncome'
import {
  getAssetQuotesQuerySchema,
  listAssetsQuerySchema,
  listMyEventsQuerySchema,
  placeOrderBodySchema,
  purchaseFixedIncomeBodySchema,
  redeemFixedIncomeBodySchema,
} from './schemas'

export interface MarketRouterDeps {
  listAssets: ListAssetsUseCase
  getAsset: GetAssetUseCase
  getAssetQuotes: GetAssetQuotesUseCase
  getCompany: GetCompanyUseCase
  getMyAccount: GetMyAccountUseCase
  listMyEvents: ListMyEventsUseCase
  placeOrder: PlaceOrderUseCase
  purchaseFixedIncome: PurchaseFixedIncomeUseCase
  redeemFixedIncome: RedeemFixedIncomeUseCase
  authMiddleware: AuthMiddleware
}

// `market` não tem regra de negócio própria — a regra de fato vive no
// engine/, que já devolve o status/mensagem certos (400/404/422/503).
// Este helper só evita repetir o mesmo bloco try/catch nas 9 rotas
// (tarefa 6.0.3).
function sendEngineError(err: unknown, res: Response): void {
  if (err instanceof EngineRequestError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  throw err
}

export function createMarketRouter(deps: MarketRouterDeps): Router {
  const router = Router()

  // --- Catálogo (leitura, qualquer usuário autenticado) ---

  router.get('/market/assets', deps.authMiddleware.authenticate, async (req, res) => {
    const parsed = listAssetsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const assets = await deps.listAssets.execute(parsed.data)
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

  router.get(
    '/market/assets/:id/quotes',
    deps.authMiddleware.authenticate,
    async (req, res) => {
      const parsed = getAssetQuotesQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
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
    },
  )

  router.get('/market/companies/:id', deps.authMiddleware.authenticate, async (req, res) => {
    try {
      const company = await deps.getCompany.execute({ id: req.params.id as string })
      res.status(200).json({ company })
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

  // --- Escrita (execução real — RF01–RF03) ---

  router.post('/market/orders', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = placeOrderBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'dados de ordem inválidos', details: z.flattenError(parsed.error) })
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
