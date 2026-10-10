import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../../domain/networth'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { MeasurePeriodReturnUseCase } from './measurePeriodReturn'

const T0 = new Date('2026-10-01T00:00:00Z')
const T1 = new Date('2026-10-08T00:00:00Z')

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: 0,
    fixedIncomeValue: 0,
    tradesExecuted: 0,
    total: 0,
    investedCost: 0,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    byClass: {
      fixedIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
      variableIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
    },
    ...overrides,
  }
}

function build(byInstant: Map<number, Snapshot>) {
  const calls: Date[] = []
  const useCase = new MeasurePeriodReturnUseCase(
    {
      async execute(input) {
        calls.push(input.asOf as Date)
        return byInstant.get((input.asOf as Date).getTime()) as Snapshot
      },
    },
    createFakeSandboxAssetReader(),
  )
  return { useCase, calls }
}

describe('MeasurePeriodReturnUseCase', () => {
  it('mede a rentabilidade entre os dois instantes e marca quem operou', async () => {
    const { useCase, calls } = build(
      new Map([
        [T0.getTime(), snap({ investedCost: 1000, variableIncomeValue: 1000, tradesExecuted: 1 })],
        [
          T1.getTime(),
          snap({ investedCost: 1000, variableIncomeValue: 1100, tradesExecuted: 3 }),
        ],
      ]),
    )
    const result = await useCase.execute({ userId: 'u', from: T0, to: T1 })
    expect(result.returnPct).toBeCloseTo(10, 5)
    expect(result.operated).toBe(true)
    expect(calls.map((d) => d.getTime()).sort()).toEqual([T0.getTime(), T1.getTime()])
  })

  it('quem não fez nada no período tem 0% e não operou', async () => {
    const same = snap({ investedCost: 1000, variableIncomeValue: 1000, tradesExecuted: 2 })
    const { useCase } = build(
      new Map([
        [T0.getTime(), same],
        [T1.getTime(), { ...same }],
      ]),
    )
    expect(await useCase.execute({ userId: 'u', from: T0, to: T1 })).toEqual({
      returnPct: 0,
      operated: false,
    })
  })

  it('operação só de renda fixa também conta como operar', async () => {
    const { useCase } = build(
      new Map([
        [T0.getTime(), snap()],
        [
          T1.getTime(),
          snap({
            investedCost: 500,
            fixedIncomeValue: 505,
            byClass: {
              fixedIncome: { investedCost: 500, disinvestedProceeds: 0, dividendsReceived: 0 },
              variableIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
            },
          }),
        ],
      ]),
    )
    const result = await useCase.execute({ userId: 'u', from: T0, to: T1 })
    expect(result.operated).toBe(true)
    expect(result.returnPct).toBeCloseTo(1, 5)
  })
})
