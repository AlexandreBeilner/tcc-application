import { describe, expect, it } from 'vitest'
import type { DailyResult } from '../../domain/content'
import { createFakeDailyResultRepository } from '../../test/fakes/fakeDailyRepositories'
import { HasCompletedDailyTodayUseCase } from './hasCompletedDailyToday'

const NOW = new Date('2026-11-02T15:00:00.000Z')

const result = (over: Partial<DailyResult> = {}): DailyResult => ({
  userId: 'u1',
  puzzleNumber: 2,
  wordGuesses: ['A'],
  wordCorrect: true,
  questionChoice: 1,
  questionCorrect: true,
  timelineOrder: ['a'],
  timelineCorrect: true,
  xpAwarded: 50,
  startedAt: new Date('2026-11-02T14:00:00.000Z'),
  completedAt: new Date('2026-11-02T14:05:00.000Z'),
  ...over,
})

const check = (rows: DailyResult[], userId = 'u1') =>
  new HasCompletedDailyTodayUseCase(createFakeDailyResultRepository(rows)).execute({
    userId,
    now: NOW,
  })

describe('HasCompletedDailyTodayUseCase', () => {
  it('é verdadeiro com o jogo do dia fechado hoje, com XP', async () => {
    expect(await check([result()])).toBe(true)
  })

  it('é falso sem jogo', async () => {
    expect(await check([])).toBe(false)
  })

  it('é falso com o jogo ainda aberto', async () => {
    expect(await check([result({ completedAt: null, xpAwarded: 0 })])).toBe(false)
  })

  it('dia anterior jogado hoje (fecha com 0 XP) não conta', async () => {
    expect(await check([result({ puzzleNumber: 1, xpAwarded: 0 })])).toBe(false)
  })

  it('jogo do dia concluído ontem não conta hoje', async () => {
    expect(await check([result({ completedAt: new Date('2026-11-01T20:00:00.000Z') })])).toBe(false)
  })

  it('não conta o jogo de outro usuário', async () => {
    expect(await check([result({ userId: 'u2' })])).toBe(false)
  })
})
