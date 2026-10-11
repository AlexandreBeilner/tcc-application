import { Router } from 'express'
import type { Redis } from 'ioredis'
import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { AssemblyKindRegistry } from './application/assemblyKinds'
import { ApplyDueAssemblyEffectsUseCase } from './application/useCases/applyDueAssemblyEffects'
import { VoteAccessService } from './application/voteAccessService'
import { CastVoteUseCase } from './application/useCases/castVote'
import { GetMyVotingStatusUseCase } from './application/useCases/getMyVotingStatus'
import { GetAssemblyUseCase } from './application/useCases/getAssembly'
import { ListAssembliesUseCase } from './application/useCases/listAssemblies'
import { ListCompanyProposalsUseCase } from './application/useCases/listCompanyProposals'
import { ProposeAgendaUseCase } from './application/useCases/proposeAgenda'
import { SupportProposalUseCase } from './application/useCases/supportProposal'
import { WithdrawProposalSupportUseCase } from './application/useCases/withdrawProposalSupport'
import { CloseDueAssembliesUseCase } from './application/useCases/closeDueAssemblies'
import { CreateAssemblyUseCase } from './application/useCases/createAssembly'
import { OpenDueAssembliesUseCase } from './application/useCases/openDueAssemblies'
import { RunAssemblyLifecycleUseCase } from './application/useCases/runAssemblyLifecycle'
import { TallyAssemblyUseCase } from './application/useCases/tallyAssembly'
import { SHAREHOLDER_KIND, shareholderPolicies } from './domain/shareholderPolicies'
import type { AssemblyConfig } from './infrastructure/config/assemblyConfig'
import { createInProcessProStatus } from './infrastructure/billing/inProcessProStatus'
import { createInProcessVoterProfileReader } from './infrastructure/profile/inProcessVoterProfileReader'
import { createAssembliesRouter } from './interfaces/http/assembliesRouter'
import { createAssemblyReadsRouter } from './interfaces/http/assemblyReadsRouter'
import { createRedisScoreboardCache } from './infrastructure/cache/redisScoreboardCache'
import { createProposalsRouter } from './interfaces/http/proposalsRouter'
import { createEngineCompanyStandingReader } from './infrastructure/engine/engineCompanyStandingReader'
import { createDrizzleProposalRepository } from './infrastructure/persistence/drizzleProposalRepository'
import { createEngineCompanyReportSource } from './infrastructure/engine/engineCompanyReportSource'
import { createEngineHoldingsSnapshotProvider } from './infrastructure/engine/engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect } from './infrastructure/engine/engineShareholderEffect'
import { createDrizzleAgendaCatalog } from './infrastructure/persistence/drizzleAgendaCatalog'
import { createDrizzleAssemblyRepository } from './infrastructure/persistence/drizzleAssemblyRepository'

// Composição do módulo `assemblies` (único lugar que instancia os adapters concretos). Hoje só
// devolve o job do ciclo (abrir, fechar e aplicar), ligado em `server.ts`, e o router (voto e
// "minha situação", propostas de pauta e apoio; leitura e placar entram na MO.6.6).
export interface AssembliesCompositionDeps {
  db: Database
  engineUrl: string
  config: AssemblyConfig
  authMiddleware: AuthMiddleware
  // Cache curto do placar de assembleia aberta.
  redis: Redis
  // Do módulo `billing`: único jeito de gatear PRO (`ProAccessGuard`).
  proAccess: { assertPro(userId: string): Promise<void> }
  // Do módulo `gamification` e do `auth`: nível e e-mail verificado do crédito gratuito.
  getProgression: Parameters<typeof createInProcessVoterProfileReader>[0]['getProgression']
  userRepository: Parameters<typeof createInProcessVoterProfileReader>[0]['userRepository']
}

export function createAssembliesModule(deps: AssembliesCompositionDeps) {
  const repository = createDrizzleAssemblyRepository(deps.db)
  const snapshots = createEngineHoldingsSnapshotProvider(deps.engineUrl)
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: createEngineShareholderEffect(deps.engineUrl),
  })

  const agendaCatalog = createDrizzleAgendaCatalog(deps.db)
  const proposals = createDrizzleProposalRepository(deps.db)
  const standings = createEngineCompanyStandingReader(deps.engineUrl)
  const proStatus = createInProcessProStatus(deps.proAccess)
  const proposalParams = () => deps.config.proposals

  const create = new CreateAssemblyUseCase(kinds, repository)
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => deps.config.params)
  const runAssemblyLifecycle = new RunAssemblyLifecycleUseCase(
    new CloseDueAssembliesUseCase(repository, tally),
    new OpenDueAssembliesUseCase(
      create,
      repository,
      createEngineCompanyReportSource(deps.engineUrl),
      agendaCatalog,
      snapshots,
      proposals,
      () => deps.config.proposals,
      () => deps.config.lifecycle,
    ),
    new ApplyDueAssemblyEffectsUseCase(kinds, repository),
  )
  const access = new VoteAccessService(
    kinds,
    repository,
    snapshots,
    proStatus,
    createInProcessVoterProfileReader(deps),
    () => deps.config.params,
  )
  const router = Router()
  router.use(
    createAssembliesRouter({
      castVote: new CastVoteUseCase(access, repository, () => deps.config.params),
      getMyVotingStatus: new GetMyVotingStatusUseCase(access, () => deps.config.params),
      authMiddleware: deps.authMiddleware,
    }),
  )
  router.use(
    createAssemblyReadsRouter({
      listAssemblies: new ListAssembliesUseCase(repository),
      getAssembly: new GetAssemblyUseCase(
        kinds,
        repository,
        snapshots,
        agendaCatalog,
        createRedisScoreboardCache(deps.redis),
        () => deps.config.params.minVoters,
      ),
      authMiddleware: deps.authMiddleware,
    }),
  )
  router.use(
    createProposalsRouter({
      listCompanyProposals: new ListCompanyProposalsUseCase(
        standings,
        agendaCatalog,
        proposals,
        proStatus,
        proposalParams,
      ),
      proposeAgenda: new ProposeAgendaUseCase(
        deps.proAccess,
        standings,
        agendaCatalog,
        proposals,
        proposalParams,
      ),
      supportProposal: new SupportProposalUseCase(
        deps.proAccess,
        standings,
        proposals,
        proposalParams,
      ),
      withdrawSupport: new WithdrawProposalSupportUseCase(proposals),
      authMiddleware: deps.authMiddleware,
    }),
  )
  return { kinds, repository, proposals, create, tally, runAssemblyLifecycle, router }
}
