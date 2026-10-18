import { describe, expect, it } from 'vitest'
import { CardAlreadyAnsweredError } from './errors'
import {
  correctCardCount,
  finalizeResult,
  isGameComplete,
  newResult,
  recordTimeline,
  recordTrivia,
  recordWordGuess,
} from './resultState'

const NOW = new Date('2026-11-02T12:00:00Z')
const base = () => newResult('u1', 2, NOW)

describe('recordWordGuess', () => {
  it('palpite errado segue em jogo e conta a tentativa', () => {
    const r = recordWordGuess(base(), 'CARRO', false)
    expect(r.attempt).toBe(1)
    expect(r.finished).toBe(false)
    expect(r.next.wordGuesses).toEqual(['CARRO'])
    expect(r.next.wordCorrect).toBeNull()
  })

  it('acertar fecha o cartão como certo', () => {
    const r = recordWordGuess({ ...base(), wordGuesses: ['A', 'B'] }, 'ACOES', true)
    expect(r.attempt).toBe(3)
    expect(r.finished).toBe(true)
    expect(r.next.wordCorrect).toBe(true)
  })

  it('a 6ª tentativa errada fecha o cartão como errado', () => {
    const r = recordWordGuess({ ...base(), wordGuesses: ['A', 'B', 'C', 'D', 'E'] }, 'F', false)
    expect(r.attempt).toBe(6)
    expect(r.next.wordCorrect).toBe(false)
  })

  it('cartão fechado recusa novo palpite', () => {
    expect(() => recordWordGuess({ ...base(), wordCorrect: false }, 'X', false)).toThrow(
      CardAlreadyAnsweredError,
    )
  })
})

describe('trivia e Linha do tempo', () => {
  it('uma tentativa válida por cartão', () => {
    const t = recordTrivia(base(), 1, true)
    expect(t.questionChoice).toBe(1)
    expect(() => recordTrivia(t, 2, false)).toThrow(CardAlreadyAnsweredError)
    const l = recordTimeline(base(), ['a', 'b'], false)
    expect(l.timelineCorrect).toBe(false)
    expect(() => recordTimeline(l, ['b', 'a'], true)).toThrow(CardAlreadyAnsweredError)
  })
})

describe('finalizeResult', () => {
  const done = (word: boolean, trivia: boolean, timeline: boolean) => ({
    ...base(),
    wordCorrect: word,
    questionCorrect: trivia,
    timelineCorrect: timeline,
  })

  it.each([
    [false, false, false, 20],
    [true, false, false, 30],
    [true, true, false, 40],
    [true, true, true, 50],
  ])('jogo do dia com palavra=%s, pergunta=%s, linha=%s dá %i XP', (w, q, t, xp) => {
    const f = finalizeResult(done(w, q, t), true, NOW)
    expect(f.justCompleted).toBe(true)
    expect(f.next.xpAwarded).toBe(xp)
    expect(f.next.completedAt).toEqual(NOW)
  })

  it('dia anterior ou depois da virada fecha com 0 XP', () => {
    const f = finalizeResult(done(true, true, true), false, NOW)
    expect(f.justCompleted).toBe(true)
    expect(f.next.xpAwarded).toBe(0)
  })

  it('só fecha com os três cartões respondidos', () => {
    const partial = { ...done(true, true, true), timelineCorrect: null }
    expect(isGameComplete(partial)).toBe(false)
    expect(finalizeResult(partial, true, NOW).justCompleted).toBe(false)
  })

  it('é idempotente: jogo já fechado não fecha de novo', () => {
    const closed = finalizeResult(done(true, true, true), true, NOW).next
    const again = finalizeResult(closed, true, new Date('2026-11-03T00:00:00Z'))
    expect(again.justCompleted).toBe(false)
    expect(again.next).toBe(closed)
  })

  it('conta cartões certos', () => {
    expect(correctCardCount(done(true, false, true))).toBe(2)
  })
})
