import { describe, expect, it } from 'vitest'
import type { ScoredEntry } from '../../domain/ranking'
import { createFakeRankingSnapshotStore } from '../../test/fakes/fakeRankingSnapshotStore'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import type { RankingScorer } from '../rankingScorer'
import { RankUsersByProfitabilityUseCase } from './rankUsersByProfitability'

const OLD = new Date('2026-01-01T00:00:00Z')
const entry = (userId: string, pct: number): ScoredEntry => ({
  userId,
  username: userId,
  level: 1,
  xp: 0,
  profitabilityPct: pct,
  sortKey: pct,
})

function build(options: {
  snapshot?: ScoredEntry[]
  live?: Record<string, number>
  liveFails?: boolean
}) {
  const directory = createFakeUserDirectory(
    ['a', 'b', 'c', 'd'].map((id) => ({ id, username: id, createdAt: OLD })),
  )
  const store = createFakeRankingSnapshotStore()
  const liveCalls: string[][] = []
  const scorer = {
    async scoreByProfitability(users: { id: string }[]) {
      liveCalls.push(users.map((u) => u.id))
      if (options.liveFails) throw new Error('motor fora')
      return {
        overall: users.map((u) => entry(u.id, options.live?.[u.id] ?? 0)),
        fixedIncome: [],
        variableIncome: [],
      }
    },
  } as unknown as RankingScorer
  const useCase = new RankUsersByProfitabilityUseCase(directory, scorer, store)
  return { useCase, store, liveCalls }
}

describe('RankUsersByProfitabilityUseCase', () => {
  it('sem snapshot calcula o grupo ao vivo, só com os pedidos, e ordena', async () => {
    const { useCase, liveCalls } = build({ live: { a: 1, b: 9, c: 5 } })
    const result = await useCase.execute({ userIds: ['a', 'b', 'c'], window: 'week' })
    expect(result.entries.map((e) => e.userId)).toEqual(['b', 'c', 'a'])
    expect(result.updatedAt).toBeNull()
    expect(liveCalls).toEqual([['a', 'b', 'c']])
  })

  it('com snapshot filtra o grupo e não recalcula ninguém', async () => {
    const { useCase, store, liveCalls } = build({})
    const computedAt = new Date('2026-10-10T09:00:00Z')
    await store.saveRun({
      computedAt,
      groups: [
        {
          criterion: 'overall',
          window: 'month',
          entries: [entry('d', 30), entry('b', 12), entry('a', 3)],
        },
      ],
    })
    const result = await useCase.execute({ userIds: ['a', 'b'], window: 'month' })
    expect(result.entries.map((e) => e.userId)).toEqual(['b', 'a'])
    expect(result.updatedAt).toEqual(computedAt)
    expect(liveCalls).toEqual([])
  })

  it('quem entrou depois do snapshot é pontuado na hora; falha do motor não derruba', async () => {
    const { useCase, store } = build({ live: { c: 50 } })
    await store.saveRun({
      computedAt: new Date(),
      groups: [{ criterion: 'overall', window: 'week', entries: [entry('a', 3)] }],
    })
    const ok = await useCase.execute({ userIds: ['a', 'c'], window: 'week' })
    expect(ok.entries.map((e) => e.userId)).toEqual(['c', 'a'])

    const failing = build({ liveFails: true })
    await failing.store.saveRun({
      computedAt: new Date(),
      groups: [{ criterion: 'overall', window: 'week', entries: [entry('a', 3)] }],
    })
    const degraded = await failing.useCase.execute({ userIds: ['a', 'c'], window: 'week' })
    expect(degraded.entries.map((e) => e.userId)).toEqual(['a'])
  })

  it('grupo vazio ou desconhecido devolve vazio sem consultar o motor', async () => {
    const { useCase, liveCalls } = build({})
    expect((await useCase.execute({ userIds: [], window: 'week' })).entries).toEqual([])
    expect((await useCase.execute({ userIds: ['zzz'], window: 'week' })).entries).toEqual([])
    expect(liveCalls).toEqual([])
  })
})
