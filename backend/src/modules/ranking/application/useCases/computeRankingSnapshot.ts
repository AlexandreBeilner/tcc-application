import {
  PROFITABILITY_CRITERIA,
  sortByRank,
  type ProfitabilityCriterion,
} from '../../domain/ranking'
import { isNearWindowStart, type WindowKind } from '../../domain/window'
import type { RankingSnapshotGroup, RankingSnapshotStore } from '../ports/rankingSnapshotStore'
import type { RankingValuationSampleStore } from '../ports/rankingValuationSampleStore'
import type { UserDirectory } from '../ports/userDirectory'
import type { RankingScorer } from '../rankingScorer'

const WINDOWS: WindowKind[] = ['week', 'month']

// Quantos dias de rodadas antigas ficam guardadas antes da limpeza.
export const RANKING_SNAPSHOT_RETENTION_DAYS = 7

// As amostras de começo de janela precisam durar a janela mais longa (mês) com folga.
export const VALUATION_SAMPLE_RETENTION_DAYS = 40

export interface ComputeRankingSnapshotResult {
  computedAt: Date
  users: number
  groups: number
}

// Calcula o ranking global de todos os critérios e janelas e grava como uma rodada só. É o job
// que roda a cada poucas horas; a tela só lê o resultado (`GetRankingUseCase`).
export class ComputeRankingSnapshotUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly scorer: RankingScorer,
    private readonly store: RankingSnapshotStore,
    private readonly sampleStore?: RankingValuationSampleStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<ComputeRankingSnapshotResult> {
    const computedAt = this.now()
    const users = await this.userDirectory.listAll()
    const groups: RankingSnapshotGroup[] = []

    groups.push({
      criterion: 'level',
      window: null,
      entries: sortByRank(await this.scorer.scoreByLevel(users)),
    })
    // O patrimônio de hoje é lido uma vez e usado pelas duas janelas. Se esta rodada cai logo
    // depois do começo de uma janela, ele também vira a amostra de "começo da janela".
    const prepared = await this.scorer.prepare(users)
    if (this.sampleStore && isNearWindowStart(computedAt)) {
      await this.sampleStore.saveSamples(
        computedAt,
        prepared.map((item) => ({ userId: item.user.id, snapshot: item.valued })),
      )
    }
    for (const window of WINDOWS) {
      const byCriterion = await this.scorer.rank(prepared, window)
      for (const criterion of PROFITABILITY_CRITERIA as ProfitabilityCriterion[]) {
        groups.push({ criterion, window, entries: sortByRank(byCriterion[criterion]) })
      }
    }

    await this.store.saveRun({ computedAt, groups })
    const cutoff = new Date(
      computedAt.getTime() - RANKING_SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    )
    await this.store.deleteRunsBefore(cutoff)
    await this.sampleStore?.deleteSamplesBefore(
      new Date(computedAt.getTime() - VALUATION_SAMPLE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    )
    return { computedAt, users: users.length, groups: groups.length }
  }
}
