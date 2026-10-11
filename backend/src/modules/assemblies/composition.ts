import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { AssemblyKindRegistry } from './application/assemblyKinds'
import { ApplyDueAssemblyEffectsUseCase } from './application/useCases/applyDueAssemblyEffects'
import { VoteAccessService } from './application/voteAccessService'
import { CastVoteUseCase } from './application/useCases/castVote'
import { GetMyVotingStatusUseCase } from './application/useCases/getMyVotingStatus'
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
import { createEngineCompanyReportSource } from './infrastructure/engine/engineCompanyReportSource'
import { createEngineHoldingsSnapshotProvider } from './infrastructure/engine/engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect } from './infrastructure/engine/engineShareholderEffect'
import { createDrizzleAgendaCatalog } from './infrastructure/persistence/drizzleAgendaCatalog'
import { createDrizzleAssemblyRepository } from './infrastructure/persistence/drizzleAssemblyRepository'

// Composição do módulo `assemblies` (único lugar que instancia os adapters concretos). Hoje só
// devolve o job do ciclo (abrir, fechar e aplicar), ligado em `server.ts`, e o router (voto e
// "minha situação"; leitura e placar entram na MO.6.6).
export interface AssembliesCompositionDeps {
  db: Database
  engineUrl: string
  config: AssemblyConfig
  authMiddleware: AuthMiddleware
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

  const create = new CreateAssemblyUseCase(kinds, repository)
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => deps.config.params)
  const runAssemblyLifecycle = new RunAssemblyLifecycleUseCase(
    new CloseDueAssembliesUseCase(repository, tally),
    new OpenDueAssembliesUseCase(
      create,
      repository,
      createEngineCompanyReportSource(deps.engineUrl),
      createDrizzleAgendaCatalog(deps.db),
      snapshots,
      () => deps.config.lifecycle,
    ),
    new ApplyDueAssemblyEffectsUseCase(kinds, repository),
  )
  const access = new VoteAccessService(
    kinds,
    repository,
    snapshots,
    createInProcessProStatus(deps.proAccess),
    createInProcessVoterProfileReader(deps),
    () => deps.config.params,
  )
  const router = createAssembliesRouter({
    castVote: new CastVoteUseCase(access, repository, () => deps.config.params),
    getMyVotingStatus: new GetMyVotingStatusUseCase(access, () => deps.config.params),
    authMiddleware: deps.authMiddleware,
  })
  return { kinds, repository, create, tally, runAssemblyLifecycle, router }
}
