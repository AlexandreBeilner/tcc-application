import { profitabilityPct } from '../../domain/profitability'
import { windowFor, type WindowKind } from '../../domain/window'
import type { FriendGraphReader } from '../ports/friendGraphReader'
import type { LevelReader } from '../ports/levelReader'
import type { SandboxAssetReader } from '../ports/sandboxAssetReader'
import type { UserDirectory } from '../ports/userDirectory'
import type { NetWorthReader } from './getNetWorth'

export type RankingScope = 'global' | 'friends'

export interface GetRankingInput {
  window: WindowKind
  scope: RankingScope
  requestingUserId: string
}

export interface RankingEntry {
  userId: string
  username: string
  level: number
  // Único dado financeiro exposto — nunca patrimônio absoluto (RNF09).
  profitabilityPct: number
}

export interface GetRankingResult {
  window: WindowKind
  scope: RankingScope
  entries: RankingEntry[]
  // Posição (1-based) do usuário que fez a requisição na lista ordenada.
  requestingUserPosition: number | null
}

export class GetRankingUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly getNetWorth: NetWorthReader,
    private readonly levelReader: LevelReader,
    private readonly friendGraphReader: FriendGraphReader,
  ) {}

  async execute(input: GetRankingInput): Promise<GetRankingResult> {
    const { start } = windowFor(input.window, new Date())
    const [allUsers, sandboxAssetIds, friendIds] = await Promise.all([
      this.userDirectory.listAll(),
      this.sandboxAssetReader.listSandboxAssetIds(),
      input.scope === 'friends'
        ? this.friendGraphReader.listAcceptedFriendIds(input.requestingUserId)
        : Promise.resolve<string[]>([]),
    ])

    // Escopo Amigos nunca recalcula patrimônio de novo — só filtra {o
    // próprio usuário} ∪ friendIds antes de calcular, evitando o custo de
    // patrimônio de todo mundo pra uma lista que só mostra alguns.
    const scopedUsers =
      input.scope === 'friends'
        ? allUsers.filter(
            (user) => user.id === input.requestingUserId || friendIds.includes(user.id),
          )
        : allUsers

    const entries = await Promise.all(
      scopedUsers.map(async (user) => {
        // "resultado consistente independente de quando o usuário entrou"
        // — quem se cadastrou no meio da janela começa a janela dele com
        // o capital inicial (RNF06), não com histórico anterior à conta.
        const baselineAsOf = start.getTime() > user.createdAt.getTime() ? start : user.createdAt

        const [baseline, current, level] = await Promise.all([
          this.getNetWorth.execute({ userId: user.id, asOf: baselineAsOf, sandboxAssetIds }),
          this.getNetWorth.execute({ userId: user.id, sandboxAssetIds }),
          this.levelReader.getLevel(user.id),
        ])

        return {
          userId: user.id,
          username: user.username,
          level,
          profitabilityPct: profitabilityPct(baseline.total, current.total),
        }
      }),
    )

    entries.sort((a, b) => b.profitabilityPct - a.profitabilityPct)
    const requestingUserIndex = entries.findIndex(
      (entry) => entry.userId === input.requestingUserId,
    )

    return {
      window: input.window,
      scope: input.scope,
      entries,
      requestingUserPosition: requestingUserIndex === -1 ? null : requestingUserIndex + 1,
    }
  }
}
