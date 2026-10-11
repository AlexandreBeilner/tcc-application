import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { EquipCosmeticUseCase } from '../../application/useCases/equipCosmetic'
import type { ListMyCosmeticsUseCase } from '../../application/useCases/listMyCosmetics'
import type { UnequipCosmeticUseCase } from '../../application/useCases/unequipCosmetic'
import { CosmeticItemNotFoundError, CosmeticLockedError } from '../../domain/errors'
import { equipBodySchema, unequipBodySchema } from './schemas'

export interface CosmeticsRouterDeps {
  listMyCosmetics: ListMyCosmeticsUseCase
  equipCosmetic: EquipCosmeticUseCase
  unequipCosmetic: UnequipCosmeticUseCase
  authMiddleware: AuthMiddleware
}

export function createCosmeticsRouter(deps: CosmeticsRouterDeps): Router {
  const router = Router()

  router.get('/me/cosmetics', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    res.status(200).json(await deps.listMyCosmetics.execute(req.auth.userId))
  })

  router.put('/me/cosmetics', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = equipBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'corpo inválido', details: z.flattenError(parsed.error) })
      return
    }
    try {
      await deps.equipCosmetic.execute({ userId: req.auth.userId, ...parsed.data })
    } catch (err) {
      if (err instanceof CosmeticItemNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof CosmeticLockedError) {
        res.status(403).json({ error: err.message })
        return
      }
      throw err
    }
    res.status(200).json(await deps.listMyCosmetics.execute(req.auth.userId))
  })

  router.delete('/me/cosmetics', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = unequipBodySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }
    await deps.unequipCosmetic.execute(req.auth.userId, parsed.data.kind)
    res.status(200).json(await deps.listMyCosmetics.execute(req.auth.userId))
  })

  return router
}
