import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type { CancelDuelUseCase } from '../../application/useCases/cancelDuel'
import type { CreateDuelUseCase } from '../../application/useCases/createDuel'
import type { GetDuelUseCase } from '../../application/useCases/getDuel'
import type { ListMyDuelsUseCase } from '../../application/useCases/listMyDuels'
import type { RespondToDuelUseCase } from '../../application/useCases/respondToDuel'
import {
  DuelAlreadyOpenError,
  DuelNotFoundError,
  DuelNotPendingError,
  NotDuelChallengerError,
  NotDuelOpponentError,
  NotFriendsError,
  SelfDuelError,
  TooManyDuelsError,
} from '../../domain/errors'
import { createDuelBodySchema, duelResponseBodySchema } from './schemas'

export interface DuelsRouterDeps {
  createDuel: CreateDuelUseCase
  respondToDuel: RespondToDuelUseCase
  cancelDuel: CancelDuelUseCase
  listMyDuels: ListMyDuelsUseCase
  getDuel: GetDuelUseCase
  authMiddleware: AuthMiddleware
}

// Erros de regra viram resposta aqui; `ProRequiredError` segue para o `jsonErrorHandler` (403).
function mapDomainError(err: unknown, res: Response): boolean {
  const table: [new (...args: never[]) => Error, number][] = [
    [DuelNotFoundError, 404],
    [SelfDuelError, 400],
    [NotFriendsError, 403],
    [NotDuelOpponentError, 403],
    [NotDuelChallengerError, 403],
    [TooManyDuelsError, 409],
    [DuelAlreadyOpenError, 409],
    [DuelNotPendingError, 409],
  ]
  for (const [ErrorClass, status] of table) {
    if (err instanceof ErrorClass) {
      res.status(status).json({ error: err.message })
      return true
    }
  }
  return false
}

export function createDuelsRouter(deps: DuelsRouterDeps): Router {
  const router = Router()
  router.param('id', requireUuidParam)
  const auth = deps.authMiddleware.authenticate

  function route(handler: (userId: string, req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response): Promise<void> => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      try {
        await handler(req.auth.userId, req, res)
      } catch (err) {
        if (!mapDomainError(err, res)) throw err
      }
    }
  }

  function badBody(res: Response, error: z.ZodError) {
    res.status(400).json({ error: 'corpo inválido', details: z.flattenError(error) })
  }

  router.get(
    '/duels',
    auth,
    route(async (userId, _req, res) => {
      res.status(200).json({ duels: await deps.listMyDuels.execute(userId) })
    }),
  )

  router.post(
    '/duels',
    auth,
    route(async (userId, req, res) => {
      const parsed = createDuelBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      const duel = await deps.createDuel.execute({ userId, opponentId: parsed.data.opponentId })
      res.status(201).json({ duel: await deps.getDuel.execute({ userId, duelId: duel.id }) })
    }),
  )

  router.get(
    '/duels/:id',
    auth,
    route(async (userId, req, res) => {
      res
        .status(200)
        .json({ duel: await deps.getDuel.execute({ userId, duelId: req.params.id as string }) })
    }),
  )

  router.post(
    '/duels/:id/response',
    auth,
    route(async (userId, req, res) => {
      const parsed = duelResponseBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      await deps.respondToDuel.execute({
        userId,
        duelId: req.params.id as string,
        accept: parsed.data.accept,
      })
      res.status(204).end()
    }),
  )

  router.delete(
    '/duels/:id',
    auth,
    route(async (userId, req, res) => {
      await deps.cancelDuel.execute({ userId, duelId: req.params.id as string })
      res.status(204).end()
    }),
  )

  return router
}
