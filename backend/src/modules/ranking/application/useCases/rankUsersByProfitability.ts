import type { ScoredEntry } from '../../domain/ranking'
import { sortByRank } from '../../domain/ranking'
import type { WindowKind } from '../../domain/window'
import type { RankingScorer } from '../rankingScorer'
import type { RankingSnapshotStore } from '../ports/rankingSnapshotStore'
import type { UserDirectory } from '../ports/userDirectory'

export interface RankedGroup {
  // Ordenado da maior para a menor rentabilidade percentual da janela. Só quem foi possível
  // pontuar; quem falhou fica de fora (mesma regra do ranking oficial).
  entries: ScoredEntry[]
  // Instante do último cálculo do snapshot servido, ou `null` quando foi calculado na hora.
  updatedAt: Date | null
}

// Ranking de um grupo fechado de pessoas (ligas privadas, duelos) pelo critério geral e a janela
// do ranking oficial. Só rentabilidade percentual: nunca patrimônio absoluto (RNF09). Lê o mesmo
// snapshot do job do ranking global (sem recalcular o patrimônio de ninguém à toa); quem entrou
// depois do último snapshot é pontuado na hora, e sem snapshot nenhum calcula o grupo todo ao
// vivo. Não toca no ranking oficial Global/Amigos.
export class RankUsersByProfitabilityUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly scorer: RankingScorer,
    private readonly snapshotStore: RankingSnapshotStore,
  ) {}

  async execute(input: { userIds: string[]; window: WindowKind }): Promise<RankedGroup> {
    const wanted = new Set(input.userIds)
    // Conta suspensa fica fora (mesmo `listAll` do ranking oficial); não perde progresso.
    const users = (await this.userDirectory.listAll()).filter((user) => wanted.has(user.id))
    if (users.length === 0) return { entries: [], updatedAt: null }

    const snapshot = await this.snapshotStore.readLatest('overall', input.window)
    if (!snapshot) {
      const live = await this.scorer.scoreByProfitability(users, input.window)
      return { entries: sortByRank(live.overall), updatedAt: null }
    }

    const inSnapshot = new Set(snapshot.entries.map((entry) => entry.userId))
    const entries = snapshot.entries.filter((entry) => wanted.has(entry.userId))
    const missing = users.filter((user) => !inSnapshot.has(user.id))
    if (missing.length > 0) {
      try {
        const live = await this.scorer.scoreByProfitability(missing, input.window)
        entries.push(...live.overall)
      } catch (err) {
        // Falha do motor não derruba a liga: a linha só fica de fora até o próximo snapshot.
        console.error('ranking: falha ao pontuar ao vivo quem entrou depois do snapshot:', err)
      }
    }
    return { entries: sortByRank(entries), updatedAt: snapshot.computedAt }
  }
}
