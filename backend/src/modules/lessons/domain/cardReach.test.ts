import { describe, expect, it } from 'vitest'
import {
  buildCardFunnel,
  isBeyond,
  isValidCardPosition,
  MAX_CARD_INDEX,
  reachDay,
} from './cardReach'

describe('isValidCardPosition', () => {
  it.each([
    [{ phase: 0, cardIndex: 0 }, true],
    [{ phase: 3, cardIndex: MAX_CARD_INDEX }, true],
    [{ phase: 4, cardIndex: 0 }, false],
    [{ phase: -1, cardIndex: 0 }, false],
    [{ phase: 1, cardIndex: MAX_CARD_INDEX + 1 }, false],
    [{ phase: 1, cardIndex: -1 }, false],
    [{ phase: 1.5, cardIndex: 0 }, false],
  ])('%j -> %s', (position, expected) => {
    expect(isValidCardPosition(position)).toBe(expected)
  })
})

describe('isBeyond', () => {
  it.each([
    [{ phase: 1, cardIndex: 0 }, { phase: 0, cardIndex: 9 }, true],
    [{ phase: 1, cardIndex: 3 }, { phase: 1, cardIndex: 2 }, true],
    [{ phase: 1, cardIndex: 2 }, { phase: 1, cardIndex: 2 }, false],
    [{ phase: 0, cardIndex: 9 }, { phase: 1, cardIndex: 0 }, false],
  ])('%j depois de %j -> %s', (a, b, expected) => {
    expect(isBeyond(a, b)).toBe(expected)
  })
})

describe('reachDay', () => {
  it('usa o dia UTC', () => {
    expect(reachDay(new Date('2026-10-18T02:30:00-03:00'))).toBe('2026-10-18')
  })
})

describe('buildCardFunnel', () => {
  it('soma os dias, ordena pela lição e mede a queda para o cartão anterior', () => {
    const funnel = buildCardFunnel([
      { phase: 1, cardIndex: 0, reached: 6 },
      { phase: 0, cardIndex: 1, reached: 8 },
      { phase: 0, cardIndex: 0, reached: 6 },
      { phase: 0, cardIndex: 0, reached: 4 },
      { phase: 0, cardIndex: 1, reached: 0 },
    ])
    expect(funnel.bars).toEqual([
      { phase: 0, cardIndex: 0, reached: 10, lost: 0, lostRate: null },
      { phase: 0, cardIndex: 1, reached: 8, lost: 2, lostRate: 0.2 },
      { phase: 1, cardIndex: 0, reached: 6, lost: 2, lostRate: 0.25 },
    ])
  })

  it('aponta o cartão com mais gente perdida, o primeiro em caso de empate', () => {
    const funnel = buildCardFunnel([
      { phase: 0, cardIndex: 0, reached: 10 },
      { phase: 0, cardIndex: 1, reached: 9 },
      { phase: 0, cardIndex: 2, reached: 4 },
      { phase: 0, cardIndex: 3, reached: 1 },
    ])
    expect(funnel.biggestDrop).toEqual({ phase: 0, cardIndex: 2 })
  })

  it('não aponta queda quando ninguém para, e nunca devolve queda negativa', () => {
    const funnel = buildCardFunnel([
      { phase: 0, cardIndex: 0, reached: 3 },
      { phase: 0, cardIndex: 1, reached: 3 },
      { phase: 1, cardIndex: 0, reached: 5 },
    ])
    expect(funnel.biggestDrop).toBeNull()
    expect(funnel.bars[2]).toMatchObject({ lost: 0, lostRate: 0 })
  })

  it('lição sem dados vira funil vazio', () => {
    expect(buildCardFunnel([])).toEqual({ bars: [], biggestDrop: null })
  })
})
