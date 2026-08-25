import { profitabilityPct } from '../../domain/profitability'
import { windowFor, type WindowKind } from '../../domain/window'
import type { SandboxAssetReader } from '../ports/sandboxAssetReader'
import type { UserDirectory } from '../ports/userDirectory'
import type { NetWorthReader } from './getNetWorth'

export interface GetRankingInput {
  window: WindowKind
  requestingUserId: string
}

export interface RankingEntry {
  userId: string
  // Único dado financeiro exposto — nunca patrimônio absoluto (RNF09).
  profitabilityPct: number
}

export interface GetRankingResult {
  window: WindowKind
  entries: RankingEntry[]
  // Posição (1-based) do usuário que fez a requisição na lista ordenada.
  requestingUserPosition: number | null
}

export class GetRankingUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly getNetWorth: NetWorthReader,
  ) {}

  async execute(input: GetRankingInput): Promise<GetRankingResult> {
    const { start } = windowFor(input.window, new Date())
    const [users, sandboxAssetIds] = await Promise.all([
      this.userDirectory.listAll(),
      this.sandboxAssetReader.listSandboxAssetIds(),
    ])

    const entries = await Promise.all(
      users.map(async (user) => {
        // "resultado consistente independente de quando o usuário entrou"
        // — quem se cadastrou no meio da janela começa a janela dele com
        // o capital inicial (RNF06), não com histórico anterior à conta.
        const baselineAsOf = start.getTime() > user.createdAt.getTime() ? start : user.createdAt

        const [baseline, current] = await Promise.all([
          this.getNetWorth.execute({ userId: user.id, asOf: baselineAsOf, sandboxAssetIds }),
          this.getNetWorth.execute({ userId: user.id, sandboxAssetIds }),
        ])

        return {
          userId: user.id,
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
      entries,
      requestingUserPosition: requestingUserIndex === -1 ? null : requestingUserIndex + 1,
    }
  }
}
