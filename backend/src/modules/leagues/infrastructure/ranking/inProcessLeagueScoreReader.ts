import type { RankedGroup } from '../../../ranking/application/useCases/rankUsersByProfitability'
import type { LeagueScoreReader } from '../../application/ports/leagueScoreReader'

// Ponte em processo para o módulo `ranking`: mesma janela e mesmo critério geral do ranking
// oficial. Só `profitabilityPct` atravessa a fronteira (RNF09).
export function createInProcessLeagueScoreReader(source: {
  execute(input: { userIds: string[]; window: 'week' | 'month' }): Promise<RankedGroup>
}): LeagueScoreReader {
  return {
    async rank(userIds, window) {
      const { entries, updatedAt } = await source.execute({ userIds, window })
      return {
        scores: entries.flatMap((entry) =>
          entry.profitabilityPct === null
            ? []
            : [
                {
                  userId: entry.userId,
                  level: entry.level,
                  profitabilityPct: entry.profitabilityPct,
                },
              ],
        ),
        updatedAt,
      }
    },
  }
}
