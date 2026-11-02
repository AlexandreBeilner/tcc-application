import { describe, expect, it } from 'vitest'
import type { MarketEventRecord, Snapshot } from '../../../ranking/domain/networth'
import type { AccountEventsReader } from '../../../ranking/application/ports/accountEventsReader'
import { createFakeSandboxAssetReader } from '../../../ranking/test/fakes/fakeSandboxAssetReader'
import { createInProcessProfitabilityReader } from './inProcessProfitabilityReader'

const HOUR = 60 * 60 * 1000
// Janela do mês de outubro/2026 (de 01/10 00:00 UTC até "agora", 31/10 12:00 UTC: T = 732 h).
const MONTH_START = new Date('2026-10-01T00:00:00Z')
const NOW = new Date('2026-10-31T12:00:00Z')
const LATE_DEPOSIT_AT = new Date(NOW.getTime() - HOUR)
const CREATED_BEFORE = new Date('2026-09-01T00:00:00Z')

const flows = () => ({ investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 })

function snapshot(investedCost: number, value: number): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: value,
    fixedIncomeValue: 0,
    tradesExecuted: 1,
    total: value,
    investedCost,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    byClass: { fixedIncome: flows(), variableIncome: { ...flows(), investedCost } },
  }
}

// R$1.000 no início do mês, +10% (+100) no mês e um aporte de R$9.000 uma hora antes de "agora":
// o custo bruto acumulado passa a R$10.000 e o valor a R$10.100.
const baseline = snapshot(1000, 1000)
const current = snapshot(10000, 10100)
const netWorth = {
  async execute(input: { asOf?: Date }): Promise<Snapshot> {
    return input.asOf ? baseline : current
  },
}
const lateDeposit: MarketEventRecord = {
  id: 'aporte',
  eventType: 'buy_order_executed',
  assetId: 'ACAO1',
  quantity: 90,
  unitValue: 100,
  timestamp: LATE_DEPOSIT_AT,
}
const eventsReader = (events: MarketEventRecord[]): AccountEventsReader => ({
  async listAllEvents() {
    return events
  },
})

describe('rentabilidade do perfil público (Dietz modificado)', () => {
  it('aporte no fim da janela não dilui o retorno: 100 / (1.000 + 9.000 × 1/732)', async () => {
    const reader = createInProcessProfitabilityReader(
      netWorth,
      createFakeSandboxAssetReader(),
      eventsReader([lateDeposit]),
      () => NOW,
    )
    const pct = await reader.getProfitabilityPct('u', 'month', CREATED_BEFORE)
    expect(pct).toBeCloseTo((100 / (1000 + 9000 / 732)) * 100, 6)
  })

  it('contraste: sem o leitor de eventos, a fórmula antiga dá 1% (100 / 10.000)', async () => {
    const reader = createInProcessProfitabilityReader(
      netWorth,
      createFakeSandboxAssetReader(),
      undefined,
      () => NOW,
    )
    expect(await reader.getProfitabilityPct('u', 'month', CREATED_BEFORE)).toBeCloseTo(1, 6)
  })

  it('sem fluxos na janela, é ganho / valor inicial (igual à fórmula antiga com custo estável)', async () => {
    const stable = {
      async execute(input: { asOf?: Date }): Promise<Snapshot> {
        return input.asOf ? snapshot(1000, 1000) : snapshot(1000, 1100)
      },
    }
    const reader = createInProcessProfitabilityReader(
      stable,
      createFakeSandboxAssetReader(),
      eventsReader([]),
      () => NOW,
    )
    expect(await reader.getProfitabilityPct('u', 'month', CREATED_BEFORE)).toBeCloseTo(10, 6)
  })

  it('compra de ativo sandbox não entra como fluxo', async () => {
    const reader = createInProcessProfitabilityReader(
      netWorth,
      createFakeSandboxAssetReader(['ACAO1']),
      eventsReader([lateDeposit]),
      () => NOW,
    )
    // Sem fluxo na janela: 100 / 1.000 = 10%.
    expect(await reader.getProfitabilityPct('u', 'month', CREATED_BEFORE)).toBeCloseTo(10, 6)
  })

  it('conta criada no meio da janela: T e a base partem da criação, não do começo do mês', async () => {
    const createdAt = new Date('2026-10-16T00:00:00Z')
    const reader = createInProcessProfitabilityReader(
      netWorth,
      createFakeSandboxAssetReader(),
      eventsReader([lateDeposit]),
      () => NOW,
    )
    const hours = (NOW.getTime() - createdAt.getTime()) / HOUR
    expect(await reader.getProfitabilityPct('u', 'month', createdAt)).toBeCloseTo(
      (100 / (1000 + 9000 / hours)) * 100,
      6,
    )
    expect(MONTH_START.getTime()).toBeLessThan(createdAt.getTime())
  })
})
