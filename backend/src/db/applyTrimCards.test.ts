import { describe, expect, it } from 'vitest'
import { trimCards } from './applyTrimCards'
import { CLOSING_CARDS, MERGES } from './trimCardsMigration'
import { LESSON_SEEDS } from './seedLessons'

const text = (markup: string) => ({ type: 'text', markup })

describe('trimCards', () => {
  it('tira o cartão final de desbloqueio e preserva o resto', () => {
    const current = { summary: ['x'], phases: { revelation: [text('a'), text(CLOSING_CARDS[0])] } }

    const { blocks, changed } = trimCards(current)

    expect(changed).toBe(1)
    expect(blocks.phases?.revelation).toEqual([text('a')])
    expect(blocks.summary).toEqual(['x'])
  })

  it('funde só dois textos seguidos com o texto exato', () => {
    const [m] = MERGES
    const { blocks, changed } = trimCards({
      phases: { revelation: [text(m.first), text(m.second)] },
    })
    expect(changed).toBe(1)
    expect(blocks.phases?.revelation).toEqual([text(`${m.first} ${m.second}`)])

    const apart = {
      phases: { revelation: [text(m.first), { type: 'check', id: 'q' }, text(m.second)] },
    }
    expect(trimCards(apart).changed).toBe(0)
  })

  it('é idempotente', () => {
    const once = trimCards({ phases: { revelation: [text('a'), text(CLOSING_CARDS[1])] } }).blocks
    expect(trimCards(once).changed).toBe(0)
  })

  it('o seed novo não tem mais nada para enxugar', () => {
    for (const seed of LESSON_SEEDS) {
      if (seed.blocks) expect(trimCards(seed.blocks as never).changed, seed.code).toBe(0)
    }
  })
})
