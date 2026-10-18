import { describe, expect, it } from 'vitest'
import { ESTIMATE_SWAPS, swapForEstimate } from './applyEstimateChecks'
import { LESSON_SEEDS } from './seedLessons'

const estimate = { type: 'check', id: 'novo', kind: 'estimate', prompt: 'p' }
const seed = {
  phases: { scenario: [{ type: 'text' }, estimate], microDecision: [], revelation: [] },
}

describe('swapForEstimate', () => {
  it('troca só o bloco antigo, na mesma posição, e preserva o resto da lição', () => {
    const current = {
      schemaVersion: 1,
      summary: ['editado'],
      phases: {
        scenario: [
          { type: 'text', edited: true },
          { type: 'check', id: 'velho', kind: 'single' },
        ],
        microDecision: [{ type: 'check', id: 'outro', kind: 'single' }],
        revelation: [],
      },
    }

    const { blocks, replaced } = swapForEstimate(current, seed, { oldId: 'velho', newId: 'novo' })

    expect(replaced).toBe(1)
    expect(blocks.phases?.scenario).toEqual([{ type: 'text', edited: true }, estimate])
    expect(blocks.phases?.microDecision).toEqual(current.phases.microDecision)
    expect(blocks.summary).toEqual(['editado'])
  })

  it('é idempotente: sem o bloco antigo (já trocado ou removido) não faz nada', () => {
    const current = { phases: { scenario: [estimate], microDecision: [], revelation: [] } }

    expect(swapForEstimate(current, seed, { oldId: 'velho', newId: 'novo' }).replaced).toBe(0)
  })

  it('não troca se o seed não tem a estimativa nova', () => {
    const current = {
      phases: {
        scenario: [{ type: 'check', id: 'velho', kind: 'single' }],
        microDecision: [],
        revelation: [],
      },
    }

    expect(swapForEstimate(current, seed, { oldId: 'velho', newId: 'inexistente' }).replaced).toBe(
      0,
    )
  })
})

describe('estimativas do seed (LJ.2.7)', () => {
  function estimateOf(newId: string) {
    const seedLesson = LESSON_SEEDS.find(
      (l) => ESTIMATE_SWAPS.find((s) => s.newId === newId)?.stableKey === l.stableKey,
    )
    const blocks = Object.values(seedLesson?.blocks?.phases ?? {}).flat()
    return blocks.find((b) => b.type === 'check' && b.id === newId)
  }

  // Os valores reais saem da conta, não de cabeça: 1.000 x 1,10^20 e companhia.
  it.each([
    ['chute-20-anos', 1000 * 1.1 ** 20],
    ['chute-preco-10-anos', 100 * 1.05 ** 10],
    ['chute-divida-12-meses', 1000 * 1.15 ** 12],
    ['chute-taxa-30-anos', 10000 * 1.1 ** 30 - 10000 * 1.08 ** 30],
  ])('%s: o valor real bate com a conta e cabe na régua', (newId, expected) => {
    const block = estimateOf(newId)

    expect(block?.type === 'check' && block.kind === 'estimate').toBe(true)
    if (block?.type !== 'check' || block.kind !== 'estimate') return
    expect(block.answer).toBeCloseTo(expected, 2)
    expect(block.answer).toBeGreaterThanOrEqual(block.min)
    expect(block.answer).toBeLessThanOrEqual(block.max)
  })

  it('cada troca tem a pergunta antiga fora do seed e a estimativa dentro', () => {
    for (const swap of ESTIMATE_SWAPS) {
      const lesson = LESSON_SEEDS.find((l) => l.stableKey === swap.stableKey)
      const ids = Object.values(lesson?.blocks?.phases ?? {})
        .flat()
        .flatMap((b) => (b.type === 'text' ? [] : [b.id]))
      expect(ids).toContain(swap.newId)
      expect(ids).not.toContain(swap.oldId)
    }
  })
})
