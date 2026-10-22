import { describe, expect, it } from 'vitest'
import type { DailyResult } from './content'
import { computeStats, computeStreaks } from './stats'

const result = (n: number, over: Partial<DailyResult> = {}): DailyResult => ({
  userId: 'u1',
  puzzleNumber: n,
  wordGuesses: ['X', 'Y', 'Z'],
  wordCorrect: true,
  questionChoice: 0,
  questionCorrect: true,
  xpAwarded: 50,
  startedAt: new Date(0),
  completedAt: new Date(1),
  ...over,
})

describe('computeStreaks', () => {
  it('conta dias seguidos concluídos no próprio dia (com XP)', () => {
    const rs = [result(1), result(2), result(3), result(5)]
    expect(computeStreaks(rs, 5)).toEqual({ currentStreak: 1, longestStreak: 3 })
  })

  it('a sequência atual continua viva se só hoje ainda não foi concluído', () => {
    expect(computeStreaks([result(3), result(4)], 5).currentStreak).toBe(2)
  })

  it('a sequência quebra se ontem ficou em branco', () => {
    expect(computeStreaks([result(2), result(3)], 5).currentStreak).toBe(0)
  })

  it('dia anterior jogado depois (sem XP) não entra na sequência', () => {
    const rs = [result(1), result(2, { xpAwarded: 0 }), result(3)]
    expect(computeStreaks(rs, 3)).toEqual({ currentStreak: 1, longestStreak: 1 })
  })

  it('sem Diário no ar não há sequência atual', () => {
    expect(computeStreaks([result(1)], null)).toEqual({ currentStreak: 0, longestStreak: 1 })
  })
})

describe('computeStats', () => {
  it('sem jogos tudo zera', () => {
    const s = computeStats([], 1)
    expect(s.games).toBe(0)
    expect(s.word).toEqual({ played: 0, correct: 0, accuracy: 0 })
    expect(s.wordAttempts.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 })
  })

  it('acerto por cartão, distribuição do Termo e jogos concluídos', () => {
    const rs = [
      result(1),
      result(2, { wordGuesses: ['A'], questionCorrect: false }),
      result(3, {
        wordCorrect: false,
        wordGuesses: ['1', '2', '3', '4', '5', '6'],
        completedAt: null,
      }),
      result(4, {
        wordCorrect: null,
        questionCorrect: null,
        completedAt: null,
      }),
    ]
    const s = computeStats(rs, 4)
    expect(s.games).toBe(2)
    expect(s.word).toEqual({ played: 3, correct: 2, accuracy: 67 })
    expect(s.trivia).toEqual({ played: 3, correct: 2, accuracy: 67 })
    expect(s.wordAttempts).toEqual({
      distribution: { '1': 1, '2': 0, '3': 1, '4': 0, '5': 0, '6': 0 },
      failed: 1,
    })
  })
})
