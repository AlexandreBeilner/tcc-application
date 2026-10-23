import { describe, expect, it } from 'vitest'
import type { DailyResult } from './content'
import { computeDailyQuality } from './quality'

const result = (n: number, over: Partial<DailyResult> = {}): DailyResult => ({
  userId: 'u1',
  puzzleNumber: n,
  wordGuesses: ['A', 'B', 'C'],
  wordCorrect: true,
  questionChoice: 0,
  questionCorrect: true,
  xpAwarded: 50,
  startedAt: new Date(0),
  completedAt: new Date(1),
  ...over,
})

describe('computeDailyQuality', () => {
  it('sem jogos tudo é zero', () => {
    expect(computeDailyQuality([])).toEqual({
      wordFirstTryGames: 0,
      perfectDays: 0,
    })
  })

  describe('palavra de primeira', () => {
    it('conta só o acerto no primeiro palpite', () => {
      const rs = [
        result(1, { wordGuesses: ['A'] }),
        result(2, { wordGuesses: ['A', 'B'] }),
        result(3, { wordGuesses: [], wordCorrect: null }),
      ]
      expect(computeDailyQuality(rs).wordFirstTryGames).toBe(1)
    })

    it('dia anterior (sem XP) não conta', () => {
      const rs = [result(1, { wordGuesses: ['A'], xpAwarded: 0 })]
      expect(computeDailyQuality(rs).wordFirstTryGames).toBe(0)
    })

    it('jogo ainda aberto não conta', () => {
      const rs = [result(1, { wordGuesses: ['A'], completedAt: null, xpAwarded: 0 })]
      expect(computeDailyQuality(rs).wordFirstTryGames).toBe(0)
    })
  })

  describe('dias perfeitos', () => {
    it('exige os dois cartões certos', () => {
      const rs = [
        result(1),
        result(2, { questionCorrect: false, xpAwarded: 35 }),
        result(3, { wordCorrect: false, xpAwarded: 35 }),
        result(4),
      ]
      expect(computeDailyQuality(rs).perfectDays).toBe(2)
    })

    it('dia perfeito jogado depois da virada (sem XP) não conta', () => {
      expect(computeDailyQuality([result(1, { xpAwarded: 0 })]).perfectDays).toBe(0)
    })
  })
})
