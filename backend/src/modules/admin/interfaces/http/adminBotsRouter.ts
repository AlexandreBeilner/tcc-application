import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  BatchTooLargeError,
  BotConflictError,
  BotNotFoundError,
  BotRejectedError,
} from '../../domain/errors'
import type { CreateAdminBotUseCase } from '../../application/useCases/createAdminBot'
import type { GetAdminBotActivityUseCase } from '../../application/useCases/getAdminBotActivity'
import type { GetAdminBotsSummaryUseCase } from '../../application/useCases/getAdminBotsSummary'
import type { ListAdminBotsUseCase } from '../../application/useCases/listAdminBots'
import type { UpdateAdminBotUseCase } from '../../application/useCases/updateAdminBot'
import {
  botActivityQuerySchema,
  botsSummaryQuerySchema,
  createBotBodySchema,
  updateBotBodySchema,
} from './schemas'

export interface AdminBotsRouterDeps {
  listAdminBots: ListAdminBotsUseCase
  createAdminBot: CreateAdminBotUseCase
  updateAdminBot: UpdateAdminBotUseCase
  getAdminBotActivity: GetAdminBotActivityUseCase
  getAdminBotsSummary: GetAdminBotsSummaryUseCase
  authMiddleware: AuthMiddleware
}

// Gestão de bots (Fase N, tarefas N.1 e N.14): lista, cria e altera (interruptor, teto e
// cobertura de Market Maker) e lê o desempenho. Proxy fino do motor; criar e alterar passam
// pela auditoria (N.4), as leituras não.
export function createAdminBotsRouter(deps: AdminBotsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  router.get('/admin/bots', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.listAdminBots.execute())
  })

  // Resumo agregado (N.14): rota fixa, declarada antes de qualquer `/admin/bots/:id`.
  router.get('/admin/bots/summary', ...adminOnly, async (req, res) => {
    const parsed = botsSummaryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }
    res.status(200).json(await deps.getAdminBotsSummary.execute(parsed.data.idle_days))
  })

  router.get('/admin/bots/:id/activity', ...adminOnly, async (req, res) => {
    const parsed = botActivityQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }
    try {
      res
        .status(200)
        .json(await deps.getAdminBotActivity.execute(req.params.id as string, parsed.data.days))
    } catch (err) {
      sendBotError(err, res)
    }
  })

  router.post('/admin/bots', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = createBotBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados do bot inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const b = parsed.data
    try {
      const created = await deps.createAdminBot.execute(req.auth.userId, {
        archetype: b.archetype,
        sectors: b.sectors,
        riskClasses: b.risk_classes,
        assetClasses: b.asset_classes,
        withinScopePct: b.within_scope_pct,
        knowledgeLevel: b.knowledge_level,
        maxPositionSizePct: b.max_position_size_pct,
        marketOrderPreference: b.market_order_preference,
        spreadWidthPct: b.spread_width_pct,
        maxCoveredAssets: b.max_covered_assets,
        initialCash: b.initial_cash,
      })
      res.status(201).json(created)
    } catch (err) {
      sendBotError(err, res)
    }
  })

  router.patch('/admin/bots/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = updateBotBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados de alteração do bot inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const updated = await deps.updateAdminBot.execute(req.auth.userId, req.params.id as string, {
        isActive: parsed.data.is_active,
        maxCoveredAssets: parsed.data.max_covered_assets,
        coveredAssetIds: parsed.data.covered_asset_ids,
      })
      res.status(200).json(updated)
    } catch (err) {
      sendBotError(err, res)
    }
  })

  return router
}

function sendBotError(err: unknown, res: Response): void {
  if (err instanceof BotRejectedError) {
    res.status(400).json({ error: err.message })
    return
  }
  if (err instanceof BotNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof BotConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  if (err instanceof BatchTooLargeError) {
    res.status(422).json({
      error: err.message,
      code: 'batch_too_large',
      matched: err.matched,
      max: err.max,
    })
    return
  }
  throw err
}
