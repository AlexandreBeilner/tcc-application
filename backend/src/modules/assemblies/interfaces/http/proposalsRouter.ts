import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type { ListCompanyProposalsUseCase } from '../../application/useCases/listCompanyProposals'
import type { ProposeAgendaUseCase } from '../../application/useCases/proposeAgenda'
import type { SupportProposalUseCase } from '../../application/useCases/supportProposal'
import type { WithdrawProposalSupportUseCase } from '../../application/useCases/withdrawProposalSupport'
import {
  CompanyNotFoundError,
  GovernanceEngineUnavailableError,
  ProposalDeniedError,
  ProposalNotFoundError,
} from '../../domain/errors'
import type { AgendaProposal } from '../../domain/proposals'
import { authedRoute } from './authedRoute'
import { proposeAgendaBodySchema } from './schemas'

export interface ProposalsRouterDeps {
  listCompanyProposals: ListCompanyProposalsUseCase
  proposeAgenda: ProposeAgendaUseCase
  supportProposal: SupportProposalUseCase
  withdrawSupport: WithdrawProposalSupportUseCase
  authMiddleware: AuthMiddleware
}

// Recusa por regra: pauta fora do catálogo é entrada inválida (400), proposta que já não está na
// fila é conflito de estado (409), o resto é falta de direito (403) com o motivo.
const DENIAL_STATUS: Record<string, number> = {
  template_unavailable: 400,
  proposal_not_active: 409,
}

function mapDomainError(err: unknown, res: Response): boolean {
  if (err instanceof ProposalNotFoundError) {
    res.status(404).json({ error: 'proposta não encontrada' })
  } else if (err instanceof GovernanceEngineUnavailableError) {
    res.status(503).json({
      error: 'o mercado está indisponível agora, tente de novo em instantes',
      reason: 'engine_unavailable',
    })
  } else if (err instanceof CompanyNotFoundError) {
    res.status(404).json({ error: 'empresa não encontrada' })
  } else if (err instanceof ProposalDeniedError) {
    res.status(DENIAL_STATUS[err.reason] ?? 403).json({ error: err.message, reason: err.reason })
  } else {
    return false
  }
  return true
}

// Nunca revela quem propôs ou apoiou: só a contagem e o que é da própria pessoa.
function present(proposal: AgendaProposal, userId: string) {
  return {
    id: proposal.id,
    templateKey: proposal.templateKey,
    supportCount: proposal.supportCount,
    supportedByMe: proposal.supportedByMe,
    proposedByMe: proposal.proposedBy === userId,
    expiresAt: proposal.expiresAt,
  }
}

// Propostas de pauta e apoio (MO.6.5). Gating de PRO fica nos casos de uso (`ProGate`), nunca aqui.
export function createProposalsRouter(deps: ProposalsRouterDeps): Router {
  const router = Router()
  router.param('companyId', requireUuidParam)
  router.param('proposalId', requireUuidParam)
  const auth = deps.authMiddleware.authenticate
  const route = (handler: Parameters<typeof authedRoute>[1]) => authedRoute(mapDomainError, handler)

  router.get(
    '/assemblies/companies/:companyId/proposals',
    auth,
    route(async (userId, req, res) => {
      res.status(200).json(
        await deps.listCompanyProposals.execute({
          companyId: String(req.params.companyId),
          userId,
        }),
      )
    }),
  )

  router.post(
    '/assemblies/companies/:companyId/proposals',
    auth,
    route(async (userId, req, res) => {
      const body = proposeAgendaBodySchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: 'corpo inválido', details: z.flattenError(body.error) })
        return
      }
      const outcome = await deps.proposeAgenda.execute({
        companyId: String(req.params.companyId),
        templateKey: body.data.templateKey,
        userId,
      })
      res.status(outcome.joinedExisting ? 200 : 201).json({
        proposal: present(outcome.proposal, userId),
        joinedExisting: outcome.joinedExisting,
      })
    }),
  )

  router.put(
    '/assemblies/proposals/:proposalId/support',
    auth,
    route(async (userId, req, res) => {
      const outcome = await deps.supportProposal.execute({
        proposalId: String(req.params.proposalId),
        userId,
      })
      res.status(outcome.alreadySupported ? 200 : 201).json({
        proposal: present(outcome.proposal, userId),
        alreadySupported: outcome.alreadySupported,
      })
    }),
  )

  router.delete(
    '/assemblies/proposals/:proposalId/support',
    auth,
    route(async (userId, req, res) => {
      const outcome = await deps.withdrawSupport.execute({
        proposalId: String(req.params.proposalId),
        userId,
      })
      res
        .status(200)
        .json({ proposal: present(outcome.proposal, userId), withdrawn: outcome.withdrawn })
    }),
  )

  return router
}
