import { describe, expect, it } from 'vitest'
import { CLARITY_FIXES, applyClarityFixes, type Blocks } from './clarityFixesMigration'
import { LESSON_SEEDS } from './seedLessons'

type Found = Record<string, unknown> & { id?: string; blocks?: Found[] }

function seedBlocks(): Found[] {
  return LESSON_SEEDS.flatMap(
    (l) => Object.values(l.blocks?.phases ?? {}).flat() as Found[],
  ).flatMap((b) => [b, ...(b.blocks ?? [])])
}

describe('applyClarityFixes', () => {
  const old: Blocks = {
    phases: {
      scenario: [
        { id: 'a', prompt: 'velho' },
        { id: 'w', goal: { text: 'missão velha', metric: 'm' } },
        { id: 'm', right: ['x', 'y', 'velho'] },
        { id: 'more', blocks: [{ id: 'dentro', prompt: 'velho' }] },
      ],
    },
  }
  const fixes = [
    { id: 'a', field: 'prompt' as const, from: 'velho', to: 'novo' },
    { id: 'w', field: 'goal.text' as const, from: 'missão velha', to: 'missão nova' },
    { id: 'm', field: 'right.2' as const, from: 'velho', to: 'novo' },
    { id: 'dentro', field: 'prompt' as const, from: 'velho', to: 'novo' },
  ]

  it('troca só o campo esperado, inclusive dentro de "Saiba mais", e preserva o resto', () => {
    const result = applyClarityFixes(old, fixes)
    const list = result.blocks.phases?.scenario as Found[]

    expect(result.changes).toBe(4)
    expect(list[0]?.prompt).toBe('novo')
    expect(list[1]?.goal).toEqual({ text: 'missão nova', metric: 'm' })
    expect(list[2]?.right).toEqual(['x', 'y', 'novo'])
    expect(list[3]?.blocks?.[0]?.prompt).toBe('novo')
  })

  it('é idempotente e respeita texto editado pelo painel', () => {
    const once = applyClarityFixes(old, fixes).blocks

    expect(applyClarityFixes(once, fixes).changes).toBe(0)
    expect(
      applyClarityFixes({ phases: { s: [{ id: 'a', prompt: 'editado' }] } }, fixes).changes,
    ).toBe(0)
  })

  it('a tabela está em dia com o seed: cada texto novo é o que o seed já traz', () => {
    const blocks = seedBlocks()
    for (const fix of CLARITY_FIXES) {
      const block = blocks.find((b) => b.id === fix.id)
      expect(block, fix.id).toBeDefined()
      const current =
        fix.field === 'goal.text'
          ? (block?.goal as { text: string }).text
          : fix.field.startsWith('right.')
            ? (block?.right as string[])[Number(fix.field.slice(6))]
            : block?.[fix.field]
      expect(current, `${fix.id} ${fix.field}`).toBe(fix.to)
      expect(fix.from).not.toBe(fix.to)
    }
  })
})
