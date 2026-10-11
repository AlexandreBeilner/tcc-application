import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type { CastVoteUseCase } from '../../application/useCases/castVote'
import type { GetMyVotingStatusUseCase } from '../../application/useCases/getMyVotingStatus'
import {
  AssemblyNotFoundError,
  InvalidAssemblyOptionError,
  VoteDeniedError,
} from '../../domain/errors'
import { castVoteBodySchema } from './schemas'

export interface AssembliesRouterDeps {
  castVote: CastVoteUseCase
  getMyVotingStatus: GetMyVotingStatusUseCase
  authMiddleware: AuthMiddleware
}

// Erros de regra viram resposta aqui; o resto segue para o `jsonErrorHandler`.
function mapDomainError(err: unknown, res: Response): boolean {
  if (err instanceof AssemblyNotFoundError) {
    res.status(404).json({ error: 'assembleia não encontrada' })
  } else if (err instanceof InvalidAssemblyOptionError) {
    res.status(400).json({ error: 'a opção não pertence a esta assembleia' })
  } else if (err instanceof VoteDeniedError) {
    // Fora da janela é conflito de estado; o resto é falta de direito (403) com o motivo.
    res
      .status(err.reason === 'not_open' ? 409 : 403)
      .json({ error: err.message, reason: err.reason })
  } else {
    return false
  }
  return true
}

export function createAssembliesRouter(deps: AssembliesRouterDeps): Router {
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

  router.post(
    '/assemblies/:id/vote',
    auth,
    route(async (userId, req, res) => {
      const body = castVoteBodySchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: 'corpo inválido', details: z.flattenError(body.error) })
        return
      }
      const outcome = await deps.castVote.execute({
        assemblyId: String(req.params.id),
        userId,
        optionId: body.data.optionId,
      })
      res.status(outcome.changed ? 200 : 201).json({ optionId: body.data.optionId, ...outcome })
    }),
  )

  router.get(
    '/assemblies/:id/me',
    auth,
    route(async (userId, req, res) => {
      res
        .status(200)
        .json(await deps.getMyVotingStatus.execute({ assemblyId: String(req.params.id), userId }))
    }),
  )

  return router
}
