import { describe, expect, it } from 'vitest'
import type { MarketEventRecord, Snapshot } from '../../../ranking/domain/networth'
import type { AccountEventsReader } from '../../../ranking/application/ports/accountEventsReader'
import { MeasurePeriodReturnUseCase } from '../../../ranking/application/useCases/measurePeriodReturn'
import { createFakeSandboxAssetReader } from '../../../ranking/test/fakes/fakeSandboxAssetReader'
import { decideDuel } from '../../domain/duel'
import { createInProcessDuelPerformanceReader } from './inProcessDuelPerformanceReader'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-10-01T00:00:00Z')
const END = new Date(START.getTime() + 7 * DAY)
// Aporte de 9.000 uma hora antes do fim do duelo.
const LATE_DEPOSIT_AT = new Date(END.getTime() - 60 * 60 * 1000)

const flows = () => ({ investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 })

function snapshot(investedCost: number, value: number, trades: number): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: value,
    fixedIncomeValue: 0,
    tradesExecuted: trades,
    total: value,
    investedCost,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    byClass: {
      fixedIncome: flows(),
      variableIncome: { ...flows(), investedCost },
    },
  }
}

// Lado A: R$1.000 que rendem 5% no período e nenhum aporte.
// Lado B: R$1.000 que rendem 10% no período e, uma hora antes do fim, um aporte de R$9.000 (que
// mal rende nesse tempo), então o custo bruto acumulado no fim é R$10.000.
const snapshots: Record<string, { start: Snapshot; end: Snapshot }> = {
  a: { start: snapshot(1000, 1000, 1), end: snapshot(1000, 1050, 2) },
  b: { start: snapshot(1000, 1000, 1), end: snapshot(10000, 10100, 3) },
}
const events: Record<string, MarketEventRecord[]> = {
  a: [],
  b: [
    {
      id: 'aporte-b',
      eventType: 'buy_order_executed',
      assetId: 'ACAO1',
      quantity: 90,
      unitValue: 100,
      timestamp: LATE_DEPOSIT_AT,
    },
  ],
}

const netWorth = {
  async execute(input: { userId: string; asOf?: Date }): Promise<Snapshot> {
    const side = snapshots[input.userId]
    return input.asOf?.getTime() === START.getTime() ? side.start : side.end
  },
}
const eventsReader: AccountEventsReader = {
  async listAllEvents(userId) {
    return events[userId]
  },
}

async function decide(withDietz: boolean) {
  const reader = createInProcessDuelPerformanceReader(
    new MeasurePeriodReturnUseCase(
      netWorth,
      createFakeSandboxAssetReader(),
      withDietz ? eventsReader : undefined,
    ),
  )
  const [a, b] = await Promise.all([
    reader.measure('a', START, END),
    reader.measure('b', START, END),
  ])
  return { a, b, decision: decideDuel(a, b) }
}

describe('duelo: aporte no fim do período não decide o vencedor', () => {
  it('com Dietz, vence quem rendeu mais (B, +10%), mesmo tendo aportado R$9.000 no fim', async () => {
    const { a, b, decision } = await decide(true)

    expect(a.returnPct).toBeCloseTo(5, 6)
    // 100 / (1.000 + 9.000 × (1h / 168h)) = 9,6%: o aporte pesa 1/168 do período.
    expect(b.returnPct).toBeCloseTo((100 / (1000 + 9000 / 168)) * 100, 6)
    expect(b.returnPct).toBeGreaterThan(a.returnPct)
    expect(decision).toEqual({ outcome: 'opponent', reason: 'profitability' })
  })

  it('contraste: pela fórmula antiga (custo bruto no fim) o aporte faria B perder, com 1%', async () => {
    const { a, b, decision } = await decide(false)

    expect(b.returnPct).toBeCloseTo(1, 6)
    expect(a.returnPct).toBeCloseTo(5, 6)
    expect(decision).toEqual({ outcome: 'challenger', reason: 'profitability' })
  })

  it('sem aporte, o vencedor é o mesmo nas duas fórmulas (B rende mais)', async () => {
    events.b = []
    snapshots.b = { start: snapshot(1000, 1000, 1), end: snapshot(1000, 1100, 2) }
    const withDietz = await decide(true)
    const legacy = await decide(false)

    expect(withDietz.decision.outcome).toBe('opponent')
    expect(legacy.decision.outcome).toBe('opponent')
    expect(withDietz.b.returnPct).toBeCloseTo(legacy.b.returnPct, 6)
  })
})
