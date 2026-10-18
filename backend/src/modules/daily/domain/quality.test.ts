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
  timelineOrder: ['a'],
  timelineCorrect: true,
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
      bestTimelineRun: 0,
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
    it('exige os três cartões certos', () => {
      const rs = [
        result(1),
        result(2, { timelineCorrect: false, xpAwarded: 40 }),
        result(3, { questionCorrect: false, xpAwarded: 40 }),
        result(4, { wordCorrect: false, xpAwarded: 40 }),
        result(5),
      ]
      expect(computeDailyQuality(rs).perfectDays).toBe(2)
    })

    it('dia perfeito jogado depois da virada (sem XP) não conta', () => {
      expect(computeDailyQuality([result(1, { xpAwarded: 0 })]).perfectDays).toBe(0)
    })
  })

  describe('sequência da Linha do tempo', () => {
    it('conta dias seguidos com a Linha do tempo certa e guarda a maior', () => {
      const rs = [1, 2, 3, 5, 6].map((n) => result(n))
      expect(computeDailyQuality(rs).bestTimelineRun).toBe(3)
    })

    it('um erro no meio quebra a sequência', () => {
      const rs = [result(1), result(2), result(3, { timelineCorrect: false }), result(4), result(5)]
      expect(computeDailyQuality(rs).bestTimelineRun).toBe(2)
    })

    it('um dia anterior jogado depois (sem XP) quebra a sequência', () => {
      const rs = [result(1), result(2, { xpAwarded: 0 }), result(3)]
      expect(computeDailyQuality(rs).bestTimelineRun).toBe(1)
    })

    it('errar a palavra não quebra a sequência da Linha do tempo', () => {
      const rs = [result(1), result(2, { wordCorrect: false, xpAwarded: 40 }), result(3)]
      expect(computeDailyQuality(rs).bestTimelineRun).toBe(3)
    })

    it('independe da ordem em que os resultados chegam', () => {
      const rs = [result(3), result(1), result(2)]
      expect(computeDailyQuality(rs).bestTimelineRun).toBe(3)
    })
  })
})
