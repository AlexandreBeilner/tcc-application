import type { GetRankingUseCase } from '../../../ranking/application/useCases/getRanking'
import { windowFor } from '../../../ranking/domain/window'
import type { AdminRankingReader } from '../../application/ports/adminRankingReader'

// Ranking global pro painel (N.19), pelo mesmo caso de uso que o jogador usa. Sem "usuário que
// pergunta": o painel olha o geral, então a posição de quem pede não entra. A janela é a
// corrente (calculada na hora, UTC), devolvida com início e fim pra tela mostrar o período.
export function createInProcessAdminRankingReader(
  getRanking: GetRankingUseCase,
  now: () => Date = () => new Date(),
): AdminRankingReader {
  return {
    async read(query) {
      const result = await getRanking.execute({
        window: query.window,
        scope: 'global',
        criterion: query.criterion,
        page: query.page,
        requestingUserId: '',
      })
      const window =
        query.criterion !== 'level' && query.window ? windowFor(query.window, now()) : null
      const offset = (result.page - 1) * result.pageSize
      return {
        window: result.window,
        windowStart: window?.start ?? null,
        windowEnd: window?.end ?? null,
        criterion: result.criterion,
        entries: result.entries.map((entry, index) => ({
          position: offset + index + 1,
          userId: entry.userId,
          username: entry.username,
          level: entry.level,
          xp: entry.xp,
          profitabilityPct: entry.profitabilityPct,
        })),
        page: result.page,
        pageSize: result.pageSize,
        totalEntries: result.totalEntries,
        totalPages: result.totalPages,
      }
    },
  }
}
