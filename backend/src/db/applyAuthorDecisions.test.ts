import { describe, expect, it } from 'vitest'
import { moveBefore, replaceGoalText } from './applyAuthorDecisions'
import { LESSON_SEEDS } from './seedLessons'

describe('moveBefore', () => {
  const blocks = {
    schemaVersion: 1,
    phases: {
      revelation: [{ id: 'texto' }, { id: 'widget' }, { id: 'chute' }, { id: 'fim' }],
    },
  }

  it('põe o bloco logo antes do outro e preserva o resto', () => {
    const result = moveBefore(blocks, 'chute', 'widget')

    expect(result.changed).toBe(true)
    expect(result.blocks.phases?.revelation?.map((b) => b.id)).toEqual([
      'texto',
      'chute',
      'widget',
      'fim',
    ])
  })

  it('é idempotente e ignora id inexistente', () => {
    const moved = moveBefore(blocks, 'chute', 'widget').blocks

    expect(moveBefore(moved, 'chute', 'widget').changed).toBe(false)
    expect(moveBefore(blocks, 'nada', 'widget').changed).toBe(false)
  })
})

describe('replaceGoalText', () => {
  const blocks = { phases: { scenario: [{ id: 'w', goal: { text: 'velho', metric: 'm' } }] } }

  it('troca só o texto da missão, uma vez, e preserva edição diferente', () => {
    const result = replaceGoalText(blocks, 'w', 'velho', 'novo')

    expect(result.changed).toBe(true)
    expect(result.blocks.phases?.scenario?.[0]?.goal).toEqual({ text: 'novo', metric: 'm' })
    expect(replaceGoalText(result.blocks, 'w', 'velho', 'novo').changed).toBe(false)
    expect(
      replaceGoalText(
        { phases: { scenario: [{ id: 'w', goal: { text: 'editado' } }] } },
        'w',
        'velho',
        'novo',
      ).changed,
    ).toBe(false)
  })
})

describe('decisões do autor no seed', () => {
  const ids = (key: string) =>
    Object.values(LESSON_SEEDS.find((l) => l.stableKey === key)?.blocks?.phases ?? {})
      .flat()
      .map((b) => (b as { id?: string }).id)

  it('o chute da 2.11 vem antes do widget fee-drag', () => {
    const list = ids('custos-de-investir')

    expect(list.indexOf('chute-taxa-30-anos')).toBeGreaterThanOrEqual(0)
    expect(list.indexOf('chute-taxa-30-anos')).toBeLessThan(list.indexOf('efeito-da-taxa'))
  })

  it('a missão da 0.4 não usa "rendimento real" antes da definição', () => {
    const widget = Object.values(
      LESSON_SEEDS.find((l) => l.stableKey === '0.4')?.blocks?.phases ?? {},
    )
      .flat()
      .find((b) => (b as { id?: string }).id === 'rendimento-real') as { goal: { text: string } }

    expect(widget.goal.text).toBe('Aumente a Inflação até ela passar o Rendimento nominal')
  })
})
