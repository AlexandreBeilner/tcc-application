import type { Snapshot } from '../domain/networth'
import {
  classReturnPct,
  investmentReturnPct,
  toRiskCapitalSnapshot,
  type ClassRiskCapital,
} from '../domain/profitability'
import type { ProfitabilityCriterion, ScoredEntry } from '../domain/ranking'
import { WINDOW_START_SAMPLE_SLACK_MS, windowFor, type WindowKind } from '../domain/window'
import type { LevelReader } from './ports/levelReader'
import type { RankingValuationSampleStore } from './ports/rankingValuationSampleStore'
import type { SandboxAssetReader } from './ports/sandboxAssetReader'
import type { NetWorthReader } from './useCases/getNetWorth'

export interface RankingUser {
  id: string
  username: string
  createdAt: Date
}

// Tudo que o ranking lê de um usuário "agora", lido uma vez e reaproveitado pelas duas janelas.
export interface PreparedUser {
  user: RankingUser
  level: number
  xp: number
  // Patrimônio de hoje com a renda fixa avaliada pelo valor de hoje (bruto de IR) e os fluxos por
  // classe do replay. É também o que o job grava como amostra de começo de janela.
  valued: Snapshot
  // O mesmo patrimônio com a renda fixa a custo, a valorização do replay.
  atCost: Snapshot
  // "Agora" reconstruído pelo replay (renda fixa a custo), usado quando não há amostra.
  replayNow: Snapshot
}

// Fluxos e valor de mercado de uma classe num instante. `null` se o snapshot não traz fluxos por
// classe (não veio do replay nem de uma amostra).
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

// "Agora" com a renda fixa a custo: o mesmo patrimônio, sem o rendimento acumulado.
function withFixedIncomeAtCost(snapshot: Snapshot): Snapshot {
  const cost = snapshot.fixedIncomeCostValue ?? snapshot.fixedIncomeValue
  return { ...snapshot, fixedIncomeValue: cost }
}

// Calcula as linhas do ranking a partir do patrimônio e do nível. É a parte pesada: usada pelo
// job de snapshot (que grava o resultado) e, quando ainda não existe snapshot, pela leitura ao
// vivo de `GetRankingUseCase`.
//
// Renda fixa: "agora" é avaliado pelo valor de hoje (o motor aplica a mesma conta do resgate).
// O começo da janela precisa estar na mesma metodologia, mas o motor não avalia no passado, então
// vem das amostras que o job guarda logo depois de cada começo de janela. Sem amostra (primeira
// janela depois da entrega, ou job parado nessa hora) o usuário é medido como antes: começo pelo
// replay e renda fixa a custo dos dois lados, sem rendimento acumulado.
export class RankingScorer {
  constructor(
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly getNetWorth: NetWorthReader,
    private readonly levelReader: LevelReader,
    private readonly sampleStore?: RankingValuationSampleStore,
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

  // Lê o patrimônio de hoje de cada usuário (a parte cara, feita uma vez por rodada).
  async prepare(users: RankingUser[]): Promise<PreparedUser[]> {
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const now = new Date()
    const prepared = await Promise.all(
      users.map(async (user): Promise<PreparedUser | null> => {
        try {
          const [fast, replayNow, { level, xp }] = await Promise.all([
            this.getNetWorth.execute({ userId: user.id, sandboxAssetIds, valuedFixedIncome: true }),
            this.getNetWorth.execute({ userId: user.id, asOf: now, sandboxAssetIds }),
            this.levelReader.getProgression(user.id),
          ])
          const valued: Snapshot = { ...fast, byClass: replayNow.byClass }
          return { user, level, xp, valued, atCost: withFixedIncomeAtCost(valued), replayNow }
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
    return prepared.filter((item): item is PreparedUser => item !== null)
  }

  // Os 3 critérios de rentabilidade de uma janela, a partir dos usuários já lidos.
  async rank(
    prepared: PreparedUser[],
    window: WindowKind,
  ): Promise<Record<ProfitabilityCriterion, ScoredEntry[]>> {
    const { start } = windowFor(window, new Date())
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const baselines =
      (await this.sampleStore?.findBaselines(
        start,
        new Date(start.getTime() + WINDOW_START_SAMPLE_SLACK_MS),
      )) ?? new Map<string, Snapshot>()
    const result: Record<ProfitabilityCriterion, ScoredEntry[]> = {
      overall: [],
      fixedIncome: [],
      variableIncome: [],
    }

    await Promise.all(
      prepared.map(async (item) => {
        const { user } = item
        // Quem se cadastrou no meio da janela começa com o capital inicial (RNF06), não com
        // histórico anterior à conta; ainda sem renda fixa nesse instante, então o valor de hoje
        // é comparável.
        const createdInWindow = user.createdAt.getTime() >= start.getTime()
        const sample = createdInWindow ? undefined : baselines.get(user.id)
        const valuedMetodology = createdInWindow || sample !== undefined

        let baseline: Snapshot
        try {
          baseline =
            sample ??
            (await this.getNetWorth.execute({
              userId: user.id,
              asOf: createdInWindow ? user.createdAt : start,
              sandboxAssetIds,
            }))
        } catch (err) {
          console.error(
            `ranking: falha ao calcular o começo da janela do usuário ${user.id}, excluído:`,
            err,
          )
          return
        }

        const overallNow = valuedMetodology ? item.valued : item.atCost
        const classNow = valuedMetodology ? item.valued : item.replayNow
        const entry = (pct: number): ScoredEntry => ({
          userId: user.id,
          username: user.username,
          level: item.level,
          xp: item.xp,
          profitabilityPct: pct,
          sortKey: pct,
        })

        // Critério "geral" (T.1): rentabilidade sobre capital de risco, nunca sobre caixa nunca
        // investido. 0% pra quem nunca investiu, nunca excluído.
        result.overall.push(
          entry(
            investmentReturnPct(toRiskCapitalSnapshot(overallNow), toRiskCapitalSnapshot(baseline)),
          ),
        )

        // Rentabilidade da classe sobre o custo investido nela (mesma lógica do geral). Quem
        // nunca investiu na classe fica fora do ranking dela, em vez de um 0% enganoso.
        for (const criterion of ['fixedIncome', 'variableIncome'] as const) {
          const currentCapital = classCapital(classNow, criterion)
          const baselineCapital = classCapital(baseline, criterion)
          if (!currentCapital || !baselineCapital) continue
          const pct = classReturnPct(currentCapital, baselineCapital)
          if (pct === null) continue
          result[criterion].push(entry(pct))
        }
      }),
    )
    return result
  }

  // Atalho: lê e ranqueia numa chamada (cálculo ao vivo sem snapshot).
  async scoreByProfitability(
    users: RankingUser[],
    window: WindowKind,
  ): Promise<Record<ProfitabilityCriterion, ScoredEntry[]>> {
    return this.rank(await this.prepare(users), window)
  }
}
