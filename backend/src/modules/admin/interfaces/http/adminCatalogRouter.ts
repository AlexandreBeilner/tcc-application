import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  CatalogAssetConflictError,
  CatalogAssetNotFoundError,
  CatalogAssetPartialError,
  CatalogAssetRejectedError,
} from '../../domain/errors'
import type { CreateCatalogAssetUseCase } from '../../application/useCases/createCatalogAsset'
import type { PreviewCatalogAssetUseCase } from '../../application/useCases/previewCatalogAsset'
import type { ListAdminCatalogUseCase } from '../../application/useCases/listAdminCatalog'
import type { UpdateCatalogAssetUseCase } from '../../application/useCases/updateCatalogAsset'
import {
  assetIdParamSchema,
  newCatalogAssetBodySchema,
  updateCatalogAssetBodySchema,
} from './schemas'

export interface AdminCatalogRouterDeps {
  listAdminCatalog: ListAdminCatalogUseCase
  updateCatalogAsset: UpdateCatalogAssetUseCase
  previewCatalogAsset: PreviewCatalogAssetUseCase
  createCatalogAsset: CreateCatalogAssetUseCase
  authMiddleware: AuthMiddleware
}

// Catálogo de ativos (Fase N, tarefa N.12): consulta e ajuste de uma lista fechada de
// campos. Campo estrutural é 400 na borda; regra de domínio recusada pelo motor é 422. A
// alteração passa pela auditoria (N.4).
export function createAdminCatalogRouter(deps: AdminCatalogRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]

  router.get('/admin/catalog', ...adminOnly, async (_req, res) => {
    res.status(200).json({ assets: await deps.listAdminCatalog.execute() })
  })

  // Cadastro de ativo novo (N.13): preview não grava nem audita; o cadastro audita.
  router.post('/admin/catalog/preview', ...adminOnly, async (req, res) => {
    const body = newCatalogAssetBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'pedido de cadastro inválido', details: z.flattenError(body.error) })
      return
    }
    try {
      res.status(200).json(await deps.previewCatalogAsset.execute(body.data))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  router.post('/admin/catalog', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const body = newCatalogAssetBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'pedido de cadastro inválido', details: z.flattenError(body.error) })
      return
    }
    try {
      res.status(201).json(await deps.createCatalogAsset.execute(req.auth.userId, body.data))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  router.patch('/admin/catalog/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const params = assetIdParamSchema.safeParse(req.params)
    if (!params.success) {
      res.status(400).json({ error: 'id do ativo deve ser um UUID válido' })
      return
    }
    const body = updateCatalogAssetBodySchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({
        error:
          'corpo inválido: só name, base_growth_pct, quality_multiplier e methodology_summary podem ser alterados',
        details: z.flattenError(body.error),
      })
      return
    }
    try {
      res
        .status(200)
        .json(await deps.updateCatalogAsset.execute(req.auth.userId, params.data.id, body.data))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  return router
}

function sendCatalogError(err: unknown, res: Response): void {
  if (err instanceof CatalogAssetNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof CatalogAssetRejectedError) {
    res.status(422).json({ error: err.message, field: err.field })
    return
  }
  if (err instanceof CatalogAssetConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  if (err instanceof CatalogAssetPartialError) {
    res.status(500).json({ error: err.message, asset_id: err.assetId })
    return
  }
  throw err
}
