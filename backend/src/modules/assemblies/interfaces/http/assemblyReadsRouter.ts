import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type { GetAssemblyUseCase } from '../../application/useCases/getAssembly'
import type { ListAssembliesUseCase } from '../../application/useCases/listAssemblies'
import { AssemblyNotFoundError } from '../../domain/errors'
import { authedRoute } from './authedRoute'
import { listAssembliesQuerySchema } from './schemas'

export interface AssemblyReadsRouterDeps {
  listAssemblies: ListAssembliesUseCase
  getAssembly: GetAssemblyUseCase
  authMiddleware: AuthMiddleware
}

function mapDomainError(err: unknown, res: Response): boolean {
  if (!(err instanceof AssemblyNotFoundError)) return false
  res.status(404).json({ error: 'assembleia não encontrada' })
  return true
}

// Leitura pública das assembleias (MO.6.6): qualquer pessoa autenticada vê pauta, placar e
// resultado; só votar e propor têm regra de acesso (nos outros routers).
export function createAssemblyReadsRouter(deps: AssemblyReadsRouterDeps): Router {
  const router = Router()
  router.param('id', requireUuidParam)
  const auth = deps.authMiddleware.authenticate
  const route = (handler: Parameters<typeof authedRoute>[1]) => authedRoute(mapDomainError, handler)

  router.get(
    '/assemblies',
    auth,
    route(async (_userId, req, res) => {
      const query = listAssembliesQuerySchema.safeParse(req.query)
      if (!query.success) {
        res
          .status(400)
          .json({ error: 'parâmetros inválidos', details: z.flattenError(query.error) })
        return
      }
      const result = await deps.listAssemblies.execute({
        status: query.data.status,
        companyId: query.data.companyId,
        closedLimit: query.data.limit,
      })
      res.status(200).json(result)
    }),
  )

  router.get(
    '/assemblies/:id',
    auth,
    route(async (_userId, req, res) => {
      res.status(200).json(await deps.getAssembly.execute(String(req.params.id)))
    }),
  )

  return router
}
