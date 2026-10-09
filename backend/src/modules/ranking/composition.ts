import type { Database } from '../../db/client'
import { GetProgressionUseCase } from '../gamification/application/useCases/getProgression'
import { createDrizzleProgressionRepository } from '../gamification/infrastructure/persistence/drizzleProgressionRepository'
import { RankingScorer } from './application/rankingScorer'
import { ComputeRankingSnapshotUseCase } from './application/useCases/computeRankingSnapshot'
import { GetNetWorthUseCase } from './application/useCases/getNetWorth'
import { createEngineAccountEventsReader } from './infrastructure/engine/engineAccountEventsReader'
import { createEngineAssetPriceHistoryReader } from './infrastructure/engine/engineAssetPriceHistoryReader'
import { createEngineCurrentAccountStateReader } from './infrastructure/engine/engineCurrentAccountStateReader'
import { createEngineSandboxAssetReader } from './infrastructure/engine/engineSandboxAssetReader'
import { createInProcessLevelReader } from './infrastructure/gamification/inProcessLevelReader'
import { createDrizzleRankingSnapshotStore } from './infrastructure/persistence/drizzleRankingSnapshotStore'
import { createDrizzleRankingValuationSampleStore } from './infrastructure/persistence/drizzleRankingValuationSampleStore'
import { createDrizzleUserDirectory } from './infrastructure/persistence/drizzleUserDirectory'

// Composição do job de snapshot do ranking, isolada de `createApp` (mesmo desenho de
// `createPayrollComposition`): o job é processo de fundo, não rota HTTP, e quem decide se/quando
// ligá-lo é `server.ts`. Sem cache de patrimônio de propósito: o job quer o valor de agora.
export function createRankingSnapshotComposition(db: Database, engineUrl: string) {
  const getNetWorth = new GetNetWorthUseCase(
    createEngineAccountEventsReader(engineUrl),
    createEngineAssetPriceHistoryReader(engineUrl),
    createEngineCurrentAccountStateReader(engineUrl),
  )
  const sampleStore = createDrizzleRankingValuationSampleStore(db)
  const scorer = new RankingScorer(
    createEngineSandboxAssetReader(engineUrl),
    getNetWorth,
    createInProcessLevelReader(new GetProgressionUseCase(createDrizzleProgressionRepository(db))),
    sampleStore,
  )
  const computeRankingSnapshot = new ComputeRankingSnapshotUseCase(
    createDrizzleUserDirectory(db),
    scorer,
    createDrizzleRankingSnapshotStore(db),
    sampleStore,
  )
  return { computeRankingSnapshot }
}
