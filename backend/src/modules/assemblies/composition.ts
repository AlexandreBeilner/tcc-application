import type { Database } from '../../db/client'
import { AssemblyKindRegistry } from './application/assemblyKinds'
import { ApplyDueAssemblyEffectsUseCase } from './application/useCases/applyDueAssemblyEffects'
import { CloseDueAssembliesUseCase } from './application/useCases/closeDueAssemblies'
import { CreateAssemblyUseCase } from './application/useCases/createAssembly'
import { OpenDueAssembliesUseCase } from './application/useCases/openDueAssemblies'
import { RunAssemblyLifecycleUseCase } from './application/useCases/runAssemblyLifecycle'
import { TallyAssemblyUseCase } from './application/useCases/tallyAssembly'
import { SHAREHOLDER_KIND, shareholderPolicies } from './domain/shareholderPolicies'
import type { AssemblyConfig } from './infrastructure/config/assemblyConfig'
import { createEngineCompanyReportSource } from './infrastructure/engine/engineCompanyReportSource'
import { createEngineHoldingsSnapshotProvider } from './infrastructure/engine/engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect } from './infrastructure/engine/engineShareholderEffect'
import { createDrizzleAgendaCatalog } from './infrastructure/persistence/drizzleAgendaCatalog'
import { createDrizzleAssemblyRepository } from './infrastructure/persistence/drizzleAssemblyRepository'

// Composição do módulo `assemblies` (único lugar que instancia os adapters concretos). Hoje só
// devolve o job do ciclo (abrir, fechar e aplicar), ligado em `server.ts`; as rotas entram com a
// MO.6.4 em diante.
export function createAssembliesModule(deps: {
  db: Database
  engineUrl: string
  config: AssemblyConfig
}) {
  const repository = createDrizzleAssemblyRepository(deps.db)
  const snapshots = createEngineHoldingsSnapshotProvider(deps.engineUrl)
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: createEngineShareholderEffect(deps.engineUrl),
  })

  const create = new CreateAssemblyUseCase(kinds, repository)
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => deps.config.tally)
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
  return { kinds, repository, create, tally, runAssemblyLifecycle }
}
