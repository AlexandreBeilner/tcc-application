import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type { CloseLeagueUseCase } from '../../application/useCases/closeLeague'
import type { CreateLeagueUseCase } from '../../application/useCases/createLeague'
import type { GetLeagueUseCase } from '../../application/useCases/getLeague'
import type { InviteToLeagueUseCase } from '../../application/useCases/inviteToLeague'
import type { LeaveLeagueUseCase } from '../../application/useCases/leaveLeague'
import type { ListMyLeaguesUseCase } from '../../application/useCases/listMyLeagues'
import type { RemoveLeagueMemberUseCase } from '../../application/useCases/removeLeagueMember'
import type { RenameLeagueUseCase } from '../../application/useCases/renameLeague'
import type { RespondToLeagueInvitationUseCase } from '../../application/useCases/respondToLeagueInvitation'
import {
  AlreadyInLeagueError,
  InvalidLeagueNameError,
  InvitationNotFoundError,
  JoinedLeaguesLimitReachedError,
  LeagueFullError,
  LeagueLimitReachedError,
  LeagueNotFoundError,
  NotFriendsError,
  NotLeagueOwnerError,
  OwnerCannotLeaveError,
} from '../../domain/errors'
import {
  createLeagueBodySchema,
  invitationResponseBodySchema,
  inviteBodySchema,
  renameLeagueBodySchema,
} from './schemas'

export interface LeaguesRouterDeps {
  createLeague: CreateLeagueUseCase
  listMyLeagues: ListMyLeaguesUseCase
  getLeague: GetLeagueUseCase
  renameLeague: RenameLeagueUseCase
  closeLeague: CloseLeagueUseCase
  inviteToLeague: InviteToLeagueUseCase
  respondToInvitation: RespondToLeagueInvitationUseCase
  leaveLeague: LeaveLeagueUseCase
  removeMember: RemoveLeagueMemberUseCase
  authMiddleware: AuthMiddleware
}

// Erros de regra viram resposta aqui; `ProRequiredError` segue para o `jsonErrorHandler` (403).
function mapDomainError(err: unknown, res: Response): boolean {
  const table: [new (...args: never[]) => Error, number][] = [
    [InvalidLeagueNameError, 400],
    [LeagueNotFoundError, 404],
    [InvitationNotFoundError, 404],
    [NotLeagueOwnerError, 403],
    [NotFriendsError, 403],
    [LeagueLimitReachedError, 409],
    [JoinedLeaguesLimitReachedError, 409],
    [LeagueFullError, 409],
    [AlreadyInLeagueError, 409],
    [OwnerCannotLeaveError, 400],
  ]
  for (const [ErrorClass, status] of table) {
    if (err instanceof ErrorClass) {
      res.status(status).json({ error: err.message })
      return true
    }
  }
  return false
}

export function createLeaguesRouter(deps: LeaguesRouterDeps): Router {
  const router = Router()
  router.param('id', requireUuidParam)
  router.param('userId', requireUuidParam)
  const auth = deps.authMiddleware.authenticate

  // Embrulha cada rota: 401 sem token, validação e mapeamento de erros de domínio num lugar só.
  function route(
    handler: (
      userId: string,
      req: Parameters<Parameters<Router['get']>[1]>[0],
      res: Response,
    ) => Promise<void>,
  ) {
    return async (
      req: Parameters<Parameters<Router['get']>[1]>[0],
      res: Response,
    ): Promise<void> => {
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
    '/leagues',
    auth,
    route(async (userId, _req, res) => {
      res.status(200).json({ leagues: await deps.listMyLeagues.execute(userId) })
    }),
  )

  router.post(
    '/leagues',
    auth,
    route(async (userId, req, res) => {
      const parsed = createLeagueBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      const league = await deps.createLeague.execute({ userId, ...parsed.data })
      res.status(201).json({ league })
    }),
  )

  router.get(
    '/leagues/:id',
    auth,
    route(async (userId, req, res) => {
      res
        .status(200)
        .json(await deps.getLeague.execute({ userId, leagueId: req.params.id as string }))
    }),
  )

  router.patch(
    '/leagues/:id',
    auth,
    route(async (userId, req, res) => {
      const parsed = renameLeagueBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      await deps.renameLeague.execute({
        userId,
        leagueId: req.params.id as string,
        name: parsed.data.name,
      })
      res.status(204).end()
    }),
  )

  router.delete(
    '/leagues/:id',
    auth,
    route(async (userId, req, res) => {
      await deps.closeLeague.execute({ userId, leagueId: req.params.id as string })
      res.status(204).end()
    }),
  )

  router.post(
    '/leagues/:id/invitations',
    auth,
    route(async (userId, req, res) => {
      const parsed = inviteBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      await deps.inviteToLeague.execute({
        userId,
        leagueId: req.params.id as string,
        targetUserId: parsed.data.userId,
      })
      res.status(201).end()
    }),
  )

  router.post(
    '/leagues/:id/invitation',
    auth,
    route(async (userId, req, res) => {
      const parsed = invitationResponseBodySchema.safeParse(req.body)
      if (!parsed.success) return badBody(res, parsed.error)
      await deps.respondToInvitation.execute({
        userId,
        leagueId: req.params.id as string,
        accept: parsed.data.accept,
      })
      res.status(204).end()
    }),
  )

  router.post(
    '/leagues/:id/leave',
    auth,
    route(async (userId, req, res) => {
      await deps.leaveLeague.execute({ userId, leagueId: req.params.id as string })
      res.status(204).end()
    }),
  )

  router.delete(
    '/leagues/:id/members/:userId',
    auth,
    route(async (userId, req, res) => {
      await deps.removeMember.execute({
        userId,
        leagueId: req.params.id as string,
        targetUserId: req.params.userId as string,
      })
      res.status(204).end()
    }),
  )

  return router
}
