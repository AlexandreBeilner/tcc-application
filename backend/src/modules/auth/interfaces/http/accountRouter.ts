import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  UsernameAlreadyInUseError,
  UserNotFoundError,
} from '../../domain/errors'
import type { AnonymizeAccountUseCase } from '../../application/useCases/anonymizeAccount'
import type { ChangePasswordUseCase } from '../../application/useCases/changePassword'
import type { ExportUserDataUseCase } from '../../application/useCases/exportUserData'
import type { ListIdentitiesUseCase } from '../../application/useCases/listIdentities'
import type { UpdateProfileUseCase } from '../../application/useCases/updateProfile'
import { changePasswordBodySchema, updateProfileBodySchema } from './schemas'
import { toPublicUser } from './userSerializer'

export interface AccountRouterDeps {
  updateProfile: UpdateProfileUseCase
  changePassword: ChangePasswordUseCase
  listIdentities: ListIdentitiesUseCase
  exportUserData: ExportUserDataUseCase
  anonymizeAccount: AnonymizeAccountUseCase
  authMiddleware: AuthMiddleware
}

// Estende modules/auth (tarefa 5.11, RNF04/telas 9.2-9.3) — router separado
// de authRouter.ts (registro/login/OAuth) só por organização, mesmo módulo,
// mesmo precedente de modules/admin (pingRouter.ts + adminMacroEventsRouter.ts).
export function createAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router()

  router.patch('/me', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = updateProfileBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const user = await deps.updateProfile.execute({ userId: req.auth.userId, ...parsed.data })
      res.status(200).json({ user: toPublicUser(user) })
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError || err instanceof UsernameAlreadyInUseError) {
        res.status(409).json({ error: err.message })
        return
      }
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/me/password', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = changePasswordBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }

    try {
      await deps.changePassword.execute({ userId: req.auth.userId, ...parsed.data })
      res.status(200).json({ status: 'senha atualizada' })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: err.message })
        return
      }
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.get('/me/identities', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const identities = await deps.listIdentities.execute({ userId: req.auth.userId })
    res.status(200).json({ identities })
  })

  router.get('/me/export', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const data = await deps.exportUserData.execute({ userId: req.auth.userId })
      res.status(200).json({ export: data })
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.delete('/me', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      await deps.anonymizeAccount.execute({ userId: req.auth.userId })
      res.status(204).send()
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
