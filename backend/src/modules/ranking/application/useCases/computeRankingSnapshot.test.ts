import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../../domain/networth'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakeRankingSnapshotStore } from '../../test/fakes/fakeRankingSnapshotStore'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { RankingScorer } from '../rankingScorer'
import {
  ComputeRankingSnapshotUseCase,
  RANKING_SNAPSHOT_RETENTION_DAYS,
} from './computeRankingSnapshot'

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    cash: 0,
    variableIncomeValue: 0,
    fixedIncomeValue: 0,
    tradesExecuted: 0,
    total: 0,
    investedCost: 0,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    ...overrides,
  }
}

const users = [
  { id: 'u1', username: 'ana', createdAt: new Date('2026-01-01T00:00:00Z') },
  { id: 'u2', username: 'bia', createdAt: new Date('2026-01-01T00:00:00Z') },
]

function build(now: Date) {
  const store = createFakeRankingSnapshotStore()
  // u1 tem R$1.000 em renda variável no começo e R$1.100 agora; u2 nunca teve nada.
  const getNetWorth = {
    async execute(input: { userId: string; asOf?: Date }) {
      if (input.userId === 'u2') return snapshot()
      return snapshot({
        investedCost: 1000,
        variableIncomeValue: input.asOf ? 1000 : 1100,
      })
    },
  }
  const scorer = new RankingScorer(
    createFakeSandboxAssetReader(),
    getNetWorth,
    createFakeLevelReader({ u1: { level: 1, xp: 10 }, u2: { level: 2, xp: 50 } }),
  )
  const useCase = new ComputeRankingSnapshotUseCase(
    createFakeUserDirectory(users),
    scorer,
    store,
    () => now,
  )
  return { store, useCase }
}

describe('ComputeRankingSnapshotUseCase', () => {
  it('grava uma rodada com nível e os 3 critérios nas duas janelas', async () => {
    const now = new Date('2026-08-26T12:00:00Z')
    const { store, useCase } = build(now)

    const result = await useCase.execute()

    expect(result).toEqual({ computedAt: now, users: 2, groups: 7 })
    expect(store.runs).toHaveLength(1)
    const keys = store.runs[0].groups.map((g) => `${g.criterion}|${g.window}`)
    expect(keys).toEqual([
      'level|null',
      'overall|week',
      'fixedIncome|week',
      'variableIncome|week',
      'overall|month',
      'fixedIncome|month',
      'variableIncome|month',
    ])
  })

  it('cada grupo sai ordenado e a classe sem posição no início da janela exclui o usuário', async () => {
    const { store, useCase } = build(new Date('2026-08-26T12:00:00Z'))
    await useCase.execute()
    const group = (criterion: string, window: string | null) =>
      store.runs[0].groups.find((g) => g.criterion === criterion && g.window === window)!

    expect(group('level', null).entries.map((e) => e.userId)).toEqual(['u2', 'u1'])
    expect(group('overall', 'week').entries.map((e) => e.userId)).toEqual(['u1', 'u2'])
    expect(group('variableIncome', 'week').entries).toEqual([
      expect.objectContaining({ userId: 'u1', profitabilityPct: expect.closeTo(10, 5) }),
    ])
    expect(group('fixedIncome', 'week').entries).toEqual([])
  })

  it('apaga as rodadas mais antigas que a retenção', async () => {
    const now = new Date('2026-08-26T12:00:00Z')
    const { store, useCase } = build(now)
    const old = new Date(now.getTime() - (RANKING_SNAPSHOT_RETENTION_DAYS + 1) * 86_400_000)
    await store.saveRun({ computedAt: old, groups: [] })

    await useCase.execute()

    expect(store.runs.map((r) => r.computedAt)).toEqual([now])
  })
})
