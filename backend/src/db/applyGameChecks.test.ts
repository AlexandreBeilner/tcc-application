import { describe, expect, it } from 'vitest'
import { GAME_SWAPS } from './applyGameChecks'
import { LESSON_SEEDS } from './seedLessons'
import { swapForCheck } from './swapChecks'

describe('swapForCheck com formatos de jogo', () => {
  const order = { type: 'check', id: 'novo', kind: 'order', prompt: 'p' }
  const seed = { phases: { scenario: [order], microDecision: [], revelation: [] } }

  it('troca a pergunta antiga na mesma posição só se o seed tem o formato esperado', () => {
    const current = {
      phases: {
        scenario: [
          { type: 'text' },
          { type: 'check', id: 'velho', kind: 'true_false' },
          { type: 'text', edited: true },
        ],
        microDecision: [],
        revelation: [],
      },
    }

    const swapped = swapForCheck(current, seed, { oldId: 'velho', newId: 'novo', kind: 'order' })
    expect(swapped.replaced).toBe(1)
    expect(swapped.blocks.phases?.scenario).toEqual([
      { type: 'text' },
      order,
      { type: 'text', edited: true },
    ])

    expect(
      swapForCheck(current, seed, { oldId: 'velho', newId: 'novo', kind: 'match' }).replaced,
    ).toBe(0)
  })

  it('é idempotente', () => {
    const swapped = swapForCheck(
      { phases: { scenario: [order], microDecision: [], revelation: [] } },
      seed,
      { oldId: 'velho', newId: 'novo', kind: 'order' },
    )

    expect(swapped.replaced).toBe(0)
  })
})

describe('perguntas de jogo do seed (LJ.2.7)', () => {
  function checkIn(stableKey: string, id: string) {
    const lesson = LESSON_SEEDS.find((l) => l.stableKey === stableKey)
    const blocks = Object.values(lesson?.blocks?.phases ?? {}).flat()
    return blocks.find((b) => b.type === 'check' && b.id === id)
  }

  it.each(GAME_SWAPS)('$stableKey: "$newId" é $kind e "$oldId" saiu do seed', (swap) => {
    expect(checkIn(swap.stableKey, swap.newId)).toMatchObject({ kind: swap.kind })
    expect(checkIn(swap.stableKey, swap.oldId)).toBeUndefined()
  })

  it('cada lição trocada continua com perguntas e dentro do máximo (7)', () => {
    for (const swap of GAME_SWAPS) {
      const lesson = LESSON_SEEDS.find((l) => l.stableKey === swap.stableKey)
      const checks = Object.values(lesson?.blocks?.phases ?? {})
        .flat()
        .filter((b) => b.type === 'check')
      expect(checks.length).toBeGreaterThanOrEqual(2)
      expect(checks.length).toBeLessThanOrEqual(7)
    }
  })
})
