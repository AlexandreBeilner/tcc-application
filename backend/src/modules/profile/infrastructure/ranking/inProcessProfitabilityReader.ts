import {
  extractWindowFlows,
  investmentDietzReturnPct,
  investmentReturnPct,
  toRiskCapitalSnapshot,
} from '../../../ranking/domain/profitability'
import { windowFor } from '../../../ranking/domain/window'
import type { AccountEventsReader } from '../../../ranking/application/ports/accountEventsReader'
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
  accountEventsReader?: AccountEventsReader,
  now: () => Date = () => new Date(),
): ProfitabilityReader {
  return {
    async getProfitabilityPct(userId, window, userCreatedAt) {
      const to = now()
      const { start } = windowFor(window, to)
      const baselineAsOf = start.getTime() > userCreatedAt.getTime() ? start : userCreatedAt
      const sandboxAssetIds = await sandboxAssetReader.listSandboxAssetIds()

      const [baseline, current] = await Promise.all([
        getNetWorth.execute({ userId, asOf: baselineAsOf, sandboxAssetIds }),
        getNetWorth.execute({ userId, sandboxAssetIds }),
      ])

      // Tarefa T.1: rentabilidade sobre capital de risco, nunca sobre caixa
      // nunca investido (ex. salário) — mesma fórmula do critério "geral"
      // do ranking (`getRanking.ts`).
      //
      // Com o leitor de eventos, o denominador é o do Dietz modificado (o mesmo do ranking e dos
      // duelos): o que o perfil público mostra é o mesmo número do ranking, e um aporte perto do
      // fim da janela não dilui o retorno. Sem ele, cai na fórmula sobre o custo investido.
      if (!accountEventsReader) {
        return investmentReturnPct(toRiskCapitalSnapshot(current), toRiskCapitalSnapshot(baseline))
      }
      const events = await accountEventsReader.listAllEvents(userId)
      return investmentDietzReturnPct(
        toRiskCapitalSnapshot(current),
        toRiskCapitalSnapshot(baseline),
        extractWindowFlows(events, sandboxAssetIds, baselineAsOf, to).overall,
        baselineAsOf,
        to,
      )
    },
  }
}
