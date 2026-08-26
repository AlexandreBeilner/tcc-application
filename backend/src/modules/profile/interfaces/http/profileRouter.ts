import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { UserNotFoundError } from '../../domain/errors'
import type { GetPublicProfileUseCase } from '../../application/useCases/getPublicProfile'
import { profileQuerySchema } from './schemas'

export interface ProfileRouterDeps {
  getPublicProfile: GetPublicProfileUseCase
  authMiddleware: AuthMiddleware
}

export function createProfileRouter(deps: ProfileRouterDeps): Router {
  const router = Router()

  router.get('/users/:id/profile', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = profileQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const profile = await deps.getPublicProfile.execute({
        // Express 5 infere `params` como `string | string[]` com mais de
        // um handler nesta rota — mesmo padrão já documentado em
        // lessonsRouter/missionsRouter/friendshipsRouter.
        userId: req.params.id as string,
        window: parsed.data.window,
      })
      res.status(200).json({ profile })
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.get('/me/profile', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = profileQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    const profile = await deps.getPublicProfile.execute({
      userId: req.auth.userId,
      window: parsed.data.window,
    })
    res.status(200).json({ profile })
  })

  return router
}
