import { profitabilityPct } from '../../../ranking/domain/profitability'
import { windowFor } from '../../../ranking/domain/window'
import type { SandboxAssetReader } from '../../../ranking/application/ports/sandboxAssetReader'
import type { NetWorthReader } from '../../../ranking/application/useCases/getNetWorth'
import type { ProfitabilityReader } from '../../application/ports/profitabilityReader'

// Duplica a lógica de baseline de `GetRankingUseCase` (5.5) — "resultado
// consistente independente de quando o usuário entrou" (RNF06): quem se
// cadastrou no meio da janela começa com o capital inicial, não com
// histórico anterior à conta. Pequena duplicação aceita (mesmo raciocínio
// de `todayUtc` repetido por módulo) — reaproveitar `GetRankingUseCase`
// inteiro pra extrair 1 usuário recalcularia patrimônio de todo mundo.
export function createInProcessProfitabilityReader(
  getNetWorth: NetWorthReader,
  sandboxAssetReader: SandboxAssetReader,
): ProfitabilityReader {
  return {
    async getProfitabilityPct(userId, window, userCreatedAt) {
      const { start } = windowFor(window, new Date())
      const baselineAsOf = start.getTime() > userCreatedAt.getTime() ? start : userCreatedAt
      const sandboxAssetIds = await sandboxAssetReader.listSandboxAssetIds()

      const [baseline, current] = await Promise.all([
        getNetWorth.execute({ userId, asOf: baselineAsOf, sandboxAssetIds }),
        getNetWorth.execute({ userId, sandboxAssetIds }),
      ])

      return profitabilityPct(baseline.total, current.total)
    },
  }
}
