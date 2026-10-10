import type { RankingCriterion, ScoredEntry } from '../../domain/ranking'
import type { WindowKind } from '../../domain/window'

// Um grupo do ranking (critério x janela). `window` é `null` no critério de nível.
export interface RankingSnapshotGroup {
  criterion: RankingCriterion
  window: WindowKind | null
  // Já ordenado (posição 1 primeiro).
  entries: ScoredEntry[]
}

export interface RankingSnapshotRun {
  computedAt: Date
  groups: RankingSnapshotGroup[]
}

export interface RankingSnapshotRead {
  computedAt: Date
  // Ordenado por posição.
  entries: ScoredEntry[]
}

// O ranking é calculado por um job a cada poucas horas e lido daqui; a tela nunca recalcula
// o patrimônio de todo mundo. `saveRun` grava a rodada inteira de forma atômica.
export interface RankingSnapshotStore {
  saveRun(run: RankingSnapshotRun): Promise<void>
  // Última rodada concluída, ou `null` se o job ainda não rodou.
  readLatest(
    criterion: RankingCriterion,
    window: WindowKind | null,
  ): Promise<RankingSnapshotRead | null>
  deleteRunsBefore(cutoff: Date): Promise<void>
}
