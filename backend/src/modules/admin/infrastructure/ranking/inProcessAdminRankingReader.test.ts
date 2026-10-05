import { describe, expect, it, vi } from 'vitest'
import type { GetRankingUseCase } from '../../../ranking/application/useCases/getRanking'
import { createInProcessAdminRankingReader } from './inProcessAdminRankingReader'

function rankingResult(overrides: Record<string, unknown> = {}) {
  return {
    window: 'week',
    scope: 'global',
    criterion: 'overall',
    entries: [
      { userId: 'u1', username: 'maria', level: 3, xp: 400, profitabilityPct: 12.5 },
      { userId: 'u2', username: 'joao', level: 2, xp: 150, profitabilityPct: -1.2 },
    ],
    requestingUserPosition: null,
    page: 2,
    pageSize: 25,
    totalEntries: 27,
    totalPages: 2,
    ...overrides,
  }
}

function build(result: Record<string, unknown>) {
  const getRanking = { execute: vi.fn().mockResolvedValue(result) }
  const reader = createInProcessAdminRankingReader(
    getRanking as unknown as GetRankingUseCase,
    () => new Date('2026-10-07T12:00:00Z'),
  )
  return { getRanking, reader }
}

describe('inProcessAdminRankingReader', () => {
  it('pede o ranking global ao mesmo caso de uso do jogador e numera pela página', async () => {
    const { getRanking, reader } = build(rankingResult())

    const ranking = await reader.read({ window: 'week', criterion: 'overall', page: 2 })

    expect(getRanking.execute).toHaveBeenCalledWith({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 2,
      requestingUserId: '',
    })
    expect(ranking.entries.map((e) => [e.position, e.username])).toEqual([
      [26, 'maria'],
      [27, 'joao'],
    ])
    expect(ranking).toMatchObject({ page: 2, pageSize: 25, totalEntries: 27, totalPages: 2 })
  })

  it.each([
    ['week', '2026-10-05T00:00:00.000Z', '2026-10-11T23:59:59.999Z'],
    ['month', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z'],
  ] as const)('devolve início e fim da janela corrente (%s, UTC)', async (window, start, end) => {
    const { reader } = build(rankingResult({ window }))

    const ranking = await reader.read({ window, criterion: 'overall', page: 1 })

    expect(ranking.windowStart?.toISOString()).toBe(start)
    expect(ranking.windowEnd?.toISOString()).toBe(end)
  })

  it('no critério de nível não há janela', async () => {
    const { reader } = build(rankingResult({ window: null, criterion: 'level' }))

    const ranking = await reader.read({ criterion: 'level', page: 1 })

    expect(ranking).toMatchObject({ window: null, windowStart: null, windowEnd: null })
  })

  it('nunca expõe patrimônio: só nível, XP e rentabilidade percentual', async () => {
    const { reader } = build(rankingResult())

    const ranking = await reader.read({ window: 'week', criterion: 'overall', page: 1 })

    for (const entry of ranking.entries) {
      expect(Object.keys(entry).sort()).toEqual(
        ['level', 'position', 'profitabilityPct', 'userId', 'username', 'xp'].sort(),
      )
    }
  })
})
