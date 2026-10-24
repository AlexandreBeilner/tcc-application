import {
  NO_COSMETICS,
  type CosmeticsReader,
  type PublicCosmetics,
} from '../../../../shared/publicCosmetics'
import { paginate } from '../../../../shared/pagination'
import type { RankingCriterion, RankingScope, ScoredEntry } from '../../domain/ranking'
import { sortByRank } from '../../domain/ranking'
import type { WindowKind } from '../../domain/window'
import type { FriendGraphReader } from '../ports/friendGraphReader'
import type { LevelReader } from '../ports/levelReader'
import type { RankingSnapshotStore } from '../ports/rankingSnapshotStore'
import type { RankingValuationSampleStore } from '../ports/rankingValuationSampleStore'
import type { SandboxAssetReader } from '../ports/sandboxAssetReader'
import type { UserDirectory } from '../ports/userDirectory'
import { RankingScorer } from '../rankingScorer'
import type { NetWorthReader } from './getNetWorth'

export type { RankingCriterion, RankingScope }

// Página fixa de 25 (backlog 6.8.2) — não é um parâmetro de query
// configurável, é convenção de produto.
export const RANKING_PAGE_SIZE = 25

export interface GetRankingInput {
  // Opcional só porque `criterion: 'level'` ignora janela por completo
  // (nível é cumulativo desde sempre) — obrigatório pros outros 3
  // critérios, validado na borda HTTP (`schemas.ts`).
  window?: WindowKind
  scope: RankingScope
  criterion: RankingCriterion
  page: number
  requestingUserId: string
}

export interface RankingEntry {
  userId: string
  username: string
  level: number
  // Sempre presente — só usado como critério de ordenação quando
  // `criterion === 'level'`, mas exposto sempre pra não obrigar o
  // frontend a lidar com dois shapes de resposta diferentes.
  xp: number
  // Único dado financeiro exposto — nunca patrimônio absoluto (RNF09).
  // `null` quando `criterion === 'level'` (rentabilidade não entra nesse
  // critério).
  profitabilityPct: number | null
  // Moldura e título (MO.5.1). Só apresentação: nunca entra na ordenação.
  cosmetics: PublicCosmetics
}

export interface GetRankingResult {
  // Ecoa o input; irrelevante (mas presente) quando `criterion === 'level'`.
  window: WindowKind | null
  scope: RankingScope
  criterion: RankingCriterion
  entries: RankingEntry[]
  // Posição (1-based) do usuário que fez a requisição na lista ordenada
  // e filtrada pelo critério ativo — independe da página pedida, pra
  // sustentar "você está em 47º" mesmo fora da página exibida.
  requestingUserPosition: number | null
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
  // Instante (ISO) do último cálculo do ranking, que é atualizado por um job a cada poucas
  // horas. `null` quando ainda não existe snapshot e a resposta foi calculada na hora.
  updatedAt: string | null
}

// O ranking é lido do snapshot gravado pelo job (`ComputeRankingSnapshotUseCase`), não
// recalculado a cada abertura da tela. Sem snapshot ainda (primeira subida, antes do job rodar),
// cai no cálculo ao vivo, para a tela nunca ficar vazia.
export class GetRankingUseCase {
  private readonly scorer: RankingScorer

  constructor(
    private readonly userDirectory: UserDirectory,
    sandboxAssetReader: SandboxAssetReader,
    getNetWorth: NetWorthReader,
    levelReader: LevelReader,
    private readonly friendGraphReader: FriendGraphReader,
    private readonly snapshotStore?: RankingSnapshotStore,
    sampleStore?: RankingValuationSampleStore,
    private readonly cosmeticsReader?: CosmeticsReader,
  ) {
    this.scorer = new RankingScorer(sandboxAssetReader, getNetWorth, levelReader, sampleStore)
  }

  async execute(input: GetRankingInput): Promise<GetRankingResult> {
    const [allUsers, friendIds] = await Promise.all([
      this.userDirectory.listAll(),
      input.scope === 'friends'
        ? this.friendGraphReader.listAcceptedFriendIds(input.requestingUserId)
        : Promise.resolve<string[]>([]),
    ])

    // Escopo Amigos só filtra {o próprio usuário} ∪ friendIds; nunca recalcula nada.
    const scopedUsers =
      input.scope === 'friends'
        ? allUsers.filter(
            (user) => user.id === input.requestingUserId || friendIds.includes(user.id),
          )
        : allUsers

    if (input.criterion !== 'level' && input.window === undefined) {
      // Guarda de runtime — a borda HTTP (`schemas.ts`) já valida isso via Zod `.refine()`,
      // mas `execute()` também é chamável direto (scripts, outras rotas, testes).
      throw new Error(`ranking: window é obrigatório para o critério "${input.criterion}"`)
    }
    const window = input.criterion === 'level' ? null : (input.window as WindowKind)

    const { entries: ranked, updatedAt } = await this.load(
      input.criterion,
      window,
      scopedUsers,
      input.requestingUserId,
    )
    const requestingUserIndex = ranked.findIndex((entry) => entry.userId === input.requestingUserId)

    const {
      items: pageEntries,
      page,
      totalEntries,
      totalPages,
    } = paginate(ranked, input.page, RANKING_PAGE_SIZE)
    const displays =
      (await this.cosmeticsReader?.findDisplays(pageEntries.map((entry) => entry.userId))) ??
      new Map<string, PublicCosmetics>()
    const entries: RankingEntry[] = pageEntries.map(
      ({ userId, username, level, xp, profitabilityPct }) => ({
        userId,
        username,
        level,
        xp,
        profitabilityPct,
        cosmetics: displays.get(userId) ?? NO_COSMETICS,
      }),
    )

    return {
      window,
      scope: input.scope,
      criterion: input.criterion,
      entries,
      requestingUserPosition: requestingUserIndex === -1 ? null : requestingUserIndex + 1,
      page,
      pageSize: RANKING_PAGE_SIZE,
      totalEntries,
      totalPages,
      updatedAt: updatedAt?.toISOString() ?? null,
    }
  }

  // Linhas ordenadas do critério, restritas aos usuários do escopo (e ativos): do snapshot se
  // existir, senão calculadas na hora.
  private async load(
    criterion: RankingCriterion,
    window: WindowKind | null,
    scopedUsers: { id: string; username: string; createdAt: Date }[],
    requestingUserId: string,
  ): Promise<{ entries: ScoredEntry[]; updatedAt: Date | null }> {
    const snapshot = await this.snapshotStore?.readLatest(criterion, window)
    if (snapshot) {
      const ids = new Set(scopedUsers.map((user) => user.id))
      const entries = snapshot.entries.filter((entry) => ids.has(entry.userId))
      // Quem se cadastrou depois da última rodada ainda não está no snapshot: calcula só a linha
      // dele ao vivo, para ele ver a própria posição sem esperar o job. Os demais usuários
      // continuam vendo a rodada gravada.
      const requester = scopedUsers.find((user) => user.id === requestingUserId)
      if (requester && requester.createdAt.getTime() > snapshot.computedAt.getTime()) {
        const own = await this.scoreOwnRow(criterion, window, requester)
        if (own) entries.push(own)
      }
      return { entries: sortByRank(entries), updatedAt: snapshot.computedAt }
    }

    if (criterion === 'level' || window === null) {
      return { entries: sortByRank(await this.scorer.scoreByLevel(scopedUsers)), updatedAt: null }
    }
    const byCriterion = await this.scorer.scoreByProfitability(scopedUsers, window)
    return { entries: sortByRank(byCriterion[criterion]), updatedAt: null }
  }

  // Linha do próprio usuário calculada na hora. Falha do motor não derruba o ranking: a linha só
  // fica de fora, como ficaria sem este caminho.
  private async scoreOwnRow(
    criterion: RankingCriterion,
    window: WindowKind | null,
    user: { id: string; username: string; createdAt: Date },
  ): Promise<ScoredEntry | undefined> {
    try {
      if (criterion === 'level' || window === null) {
        return (await this.scorer.scoreByLevel([user]))[0]
      }
      return (await this.scorer.scoreByProfitability([user], window))[criterion][0]
    } catch (err) {
      console.error(`ranking: falha ao calcular a linha ao vivo do usuário ${user.id}:`, err)
      return undefined
    }
  }
}
