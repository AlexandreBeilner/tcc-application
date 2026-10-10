import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassFlows, Snapshot } from '../domain/networth'
import { createFakeLevelReader } from '../test/fakes/fakeLevelReader'
import { createFakeRankingValuationSampleStore } from '../test/fakes/fakeRankingValuationSampleStore'
import { createFakeSandboxAssetReader } from '../test/fakes/fakeSandboxAssetReader'
import { RankingScorer } from './rankingScorer'

const NOW = new Date('2026-08-26T12:00:00Z') // quarta, semana de 24 a 30 de agosto
const WEEK_START = new Date('2026-08-24T00:00:00Z')
const flows = (f: Partial<ClassFlows> = {}): ClassFlows => ({
  investedCost: 0,
  disinvestedProceeds: 0,
  dividendsReceived: 0,
  ...f,
})

// Um usuário com R$1.000 em renda fixa: custo 1.000, valor de hoje 1.010 (rendimento acumulado).
function fixedIncomeSnapshot(value: number, cost = 1000): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: 0,
    fixedIncomeValue: value,
    tradesExecuted: 0,
    total: 0,
    investedCost: cost,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    byClass: { fixedIncome: flows({ investedCost: cost }), variableIncome: flows() },
  }
}

// Fake do patrimônio: "agora" do motor (com ou sem avaliação), "agora" por replay e o replay do
// começo da janela, distinguidos pelas opções da chamada.
function fakeNetWorth(opts: { valuedNow: Snapshot; costNow: Snapshot; replayBaseline: Snapshot }) {
  return {
    async execute(input: { asOf?: Date; valuedFixedIncome?: boolean }) {
      if (!input.asOf) {
        return input.valuedFixedIncome
          ? { ...opts.valuedNow, fixedIncomeCostValue: opts.costNow.fixedIncomeValue }
          : opts.costNow
      }
      return input.asOf.getTime() >= Date.now() ? opts.costNow : opts.replayBaseline
    },
  }
}

const user = (createdAt: string) => ({ id: 'u1', username: 'ana', createdAt: new Date(createdAt) })

describe('RankingScorer, renda fixa pelo valor de hoje', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('com amostra do começo da janela, o rendimento acumulado só conta a partir dali', async () => {
    const sampleStore = createFakeRankingValuationSampleStore()
    // Amostra da segunda 01:00: a posição já valia 1.005 (0,5% de rendimento antes da janela).
    await sampleStore.saveSamples(new Date('2026-08-24T01:00:00Z'), [
      { userId: 'u1', snapshot: fixedIncomeSnapshot(1005) },
    ])
    const scorer = new RankingScorer(
      createFakeSandboxAssetReader(),
      fakeNetWorth({
        valuedNow: fixedIncomeSnapshot(1010),
        costNow: fixedIncomeSnapshot(1000),
        replayBaseline: fixedIncomeSnapshot(1000),
      }),
      createFakeLevelReader(),
      sampleStore,
    )

    const result = await scorer.scoreByProfitability([user('2026-01-01T00:00:00Z')], 'week')

    // (1010 - 1005) / 1000 = 0,5% na janela, não 1% desde a compra.
    expect(result.fixedIncome[0].profitabilityPct).toBeCloseTo(0.5)
    expect(result.overall[0].profitabilityPct).toBeCloseTo(0.5)
  })

  it('sem amostra, mede como antes: renda fixa a custo dos dois lados, sem rendimento acumulado', async () => {
    const scorer = new RankingScorer(
      createFakeSandboxAssetReader(),
      fakeNetWorth({
        valuedNow: fixedIncomeSnapshot(1010),
        costNow: fixedIncomeSnapshot(1000),
        replayBaseline: fixedIncomeSnapshot(1000),
      }),
      createFakeLevelReader(),
      createFakeRankingValuationSampleStore(),
    )

    const result = await scorer.scoreByProfitability([user('2026-01-01T00:00:00Z')], 'week')

    expect(result.fixedIncome[0].profitabilityPct).toBeCloseTo(0)
    expect(result.overall[0].profitabilityPct).toBeCloseTo(0)
  })

  it('amostra fora da tolerância depois do começo da janela não conta como começo', async () => {
    const sampleStore = createFakeRankingValuationSampleStore()
    await sampleStore.saveSamples(new Date('2026-08-24T09:00:00Z'), [
      { userId: 'u1', snapshot: fixedIncomeSnapshot(1008) },
    ])
    const scorer = new RankingScorer(
      createFakeSandboxAssetReader(),
      fakeNetWorth({
        valuedNow: fixedIncomeSnapshot(1010),
        costNow: fixedIncomeSnapshot(1000),
        replayBaseline: fixedIncomeSnapshot(1000),
      }),
      createFakeLevelReader(),
      sampleStore,
    )

    const result = await scorer.scoreByProfitability([user('2026-01-01T00:00:00Z')], 'week')

    expect(result.fixedIncome[0].profitabilityPct).toBeCloseTo(0)
  })

  it('conta criada no meio da janela compara o valor de hoje com o capital inicial', async () => {
    const empty = fixedIncomeSnapshot(0, 0)
    const scorer = new RankingScorer(
      createFakeSandboxAssetReader(),
      fakeNetWorth({
        valuedNow: fixedIncomeSnapshot(1010),
        costNow: fixedIncomeSnapshot(1000),
        replayBaseline: empty,
      }),
      createFakeLevelReader(),
      createFakeRankingValuationSampleStore(),
    )

    const result = await scorer.scoreByProfitability([user('2026-08-25T00:00:00Z')], 'week')

    // Investiu 1.000 dentro da janela e já rendeu 10: 1%.
    expect(result.fixedIncome[0].profitabilityPct).toBeCloseTo(1)
  })

  it('o começo da janela de quem não tem amostra vem do replay, a partir do início da janela', async () => {
    const calls: Date[] = []
    const net = fakeNetWorth({
      valuedNow: fixedIncomeSnapshot(1010),
      costNow: fixedIncomeSnapshot(1000),
      replayBaseline: fixedIncomeSnapshot(1000),
    })
    const scorer = new RankingScorer(
      createFakeSandboxAssetReader(),
      {
        execute: async (input) => {
          if (input.asOf) calls.push(input.asOf)
          return net.execute(input)
        },
      },
      createFakeLevelReader(),
    )

    await scorer.scoreByProfitability([user('2026-01-01T00:00:00Z')], 'week')

    expect(calls.map((d) => d.toISOString())).toContain(WEEK_START.toISOString())
  })
})
