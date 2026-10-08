import type { Snapshot } from '../domain/networth'
import {
  classReturnPct,
  investmentReturnPct,
  toRiskCapitalSnapshot,
  type ClassRiskCapital,
} from '../domain/profitability'
import type { ProfitabilityCriterion, ScoredEntry } from '../domain/ranking'
import { windowFor, type WindowKind } from '../domain/window'
import type { LevelReader } from './ports/levelReader'
import type { SandboxAssetReader } from './ports/sandboxAssetReader'
import type { NetWorthReader } from './useCases/getNetWorth'

export interface RankingUser {
  id: string
  username: string
  createdAt: Date
}

// Fluxos e valor de mercado de uma classe num instante, a partir do replay. `null` se o snapshot
// não veio do replay (sem `byClass`). O critério `overall` não usa isso (tarefa T.1).
function classCapital(
  snapshot: Snapshot,
  criterion: 'fixedIncome' | 'variableIncome',
): ClassRiskCapital | null {
  const flows = snapshot.byClass?.[criterion]
  if (!flows) return null
  const currentValue =
    criterion === 'fixedIncome' ? snapshot.fixedIncomeValue : snapshot.variableIncomeValue
  return { ...flows, currentValue }
}

// Calcula as linhas do ranking a partir do patrimônio e do nível. É a parte pesada: usada pelo
// job de snapshot (que grava o resultado) e, quando ainda não existe snapshot, pela leitura ao
// vivo de `GetRankingUseCase`.
export class RankingScorer {
  constructor(
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly getNetWorth: NetWorthReader,
    private readonly levelReader: LevelReader,
  ) {}

  // Critério "maior nível" (6.8.3): não chama o motor nem usa janela, só lê `user_progression`
  // por usuário. Cumulativo desde sempre.
  async scoreByLevel(users: { id: string; username: string }[]): Promise<ScoredEntry[]> {
    const settled = await Promise.all(
      users.map(async (user): Promise<ScoredEntry | null> => {
        try {
          const { level, xp } = await this.levelReader.getProgression(user.id)
          return {
            userId: user.id,
            username: user.username,
            level,
            xp,
            profitabilityPct: null,
            sortKey: xp,
          }
        } catch (err) {
          // Um usuário sem progressão consistente não pode derrubar o ranking dos demais.
          console.error(
            `ranking: falha ao calcular nível do usuário ${user.id}, excluído desta resposta:`,
            err,
          )
          return null
        }
      }),
    )
    return settled.filter((entry): entry is ScoredEntry => entry !== null)
  }

  // Os 3 critérios de rentabilidade de uma janela, numa passada só: o patrimônio do começo da
  // janela e o de agora são lidos uma vez por usuário e alimentam os três.
  async scoreByProfitability(
    users: RankingUser[],
    window: WindowKind,
  ): Promise<Record<ProfitabilityCriterion, ScoredEntry[]>> {
    const now = new Date()
    const { start } = windowFor(window, now)
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const result: Record<ProfitabilityCriterion, ScoredEntry[]> = {
      overall: [],
      fixedIncome: [],
      variableIncome: [],
    }

    const perUser = await Promise.all(
      users.map(async (user) => {
        // "resultado consistente independente de quando o usuário entrou": quem se cadastrou no
        // meio da janela começa com o capital inicial (RNF06), não com histórico anterior.
        const baselineAsOf = start.getTime() > user.createdAt.getTime() ? start : user.createdAt
        try {
          // `current` (estado do motor) alimenta o critério geral. `currentReplay` reconstrói o
          // mesmo instante pelo log de eventos e é o que separa os fluxos por classe, na mesma
          // metodologia de valorização do `baseline` (os dois lados por replay).
          const [baseline, current, currentReplay, { level, xp }] = await Promise.all([
            this.getNetWorth.execute({ userId: user.id, asOf: baselineAsOf, sandboxAssetIds }),
            this.getNetWorth.execute({ userId: user.id, sandboxAssetIds }),
            this.getNetWorth.execute({ userId: user.id, asOf: now, sandboxAssetIds }),
            this.levelReader.getProgression(user.id),
          ])
          return { user, baseline, current, currentReplay, level, xp }
        } catch (err) {
          // Usuário sem estado consistente no motor não derruba o ranking dos demais.
          console.error(
            `ranking: falha ao calcular patrimônio do usuário ${user.id}, excluído desta resposta:`,
            err,
          )
          return null
        }
      }),
    )

    for (const item of perUser) {
      if (!item) continue
      const { user, baseline, current, currentReplay, level, xp } = item
      const entry = (pct: number): ScoredEntry => ({
        userId: user.id,
        username: user.username,
        level,
        xp,
        profitabilityPct: pct,
        sortKey: pct,
      })

      // Critério "geral" (T.1): rentabilidade sobre capital de risco, nunca sobre caixa nunca
      // investido. 0% pra quem nunca investiu, nunca excluído.
      result.overall.push(
        entry(investmentReturnPct(toRiskCapitalSnapshot(current), toRiskCapitalSnapshot(baseline))),
      )

      // Rentabilidade da classe sobre o custo investido nela (mesma lógica do geral). Quem nunca
      // investiu na classe fica fora do ranking dela, em vez de um 0% enganoso.
      for (const criterion of ['fixedIncome', 'variableIncome'] as const) {
        const currentCapital = classCapital(currentReplay, criterion)
        const baselineCapital = classCapital(baseline, criterion)
        if (!currentCapital || !baselineCapital) continue
        const pct = classReturnPct(currentCapital, baselineCapital)
        if (pct === null) continue
        result[criterion].push(entry(pct))
      }
    }
    return result
  }
}
