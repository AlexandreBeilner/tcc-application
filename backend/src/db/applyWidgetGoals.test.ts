import { describe, expect, it } from 'vitest'
import { applyWidgetGoals } from './applyWidgetGoals'
import { LESSON_SEEDS } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'

const goal = { text: 't', metric: 'realReturnPct', op: 'lt', value: 0, reveal: 'r' }
const seedWidget = {
  type: 'widget',
  id: 'w',
  widget: 'real-return',
  props: { nominalPct: 8 },
  goal,
}
const seed = {
  phases: { scenario: [], microDecision: [], revelation: [{ type: 'text' }, seedWidget] },
}

describe('applyWidgetGoals', () => {
  it('leva a missão e os valores iniciais ao widget existente e preserva o resto', () => {
    const current = {
      summary: ['editado'],
      phases: {
        scenario: [],
        microDecision: [],
        revelation: [
          { type: 'text', edited: true },
          {
            type: 'widget',
            id: 'w',
            widget: 'real-return',
            props: { inflationPct: 5 },
            caption: 'c',
          },
        ],
      },
    }

    const { blocks, changed } = applyWidgetGoals(current, seed)

    expect(changed).toBe(1)
    expect(blocks.phases?.revelation?.[0]).toEqual({ type: 'text', edited: true })
    expect(blocks.phases?.revelation?.[1]).toEqual({
      type: 'widget',
      id: 'w',
      widget: 'real-return',
      props: { inflationPct: 5, nominalPct: 8 },
      caption: 'c',
      goal,
    })
    expect(blocks.summary).toEqual(['editado'])
  })

  it('insere o widget que ainda não existe depois do bloco que o antecede no seed (texto casa pelo conteúdo)', () => {
    const text = { type: 'text', markup: 'antes' }
    const current = {
      phases: { revelation: [text, { type: 'text', markup: 'depois' }] },
    }

    const { blocks, changed } = applyWidgetGoals(current, {
      phases: { revelation: [text, seedWidget, { type: 'text', markup: 'depois' }] },
    })

    expect(changed).toBe(1)
    expect(blocks.phases?.revelation).toEqual([
      text,
      seedWidget,
      { type: 'text', markup: 'depois' },
    ])
  })

  it('se o bloco anterior sumiu do banco, o widget entra no fim da fase', () => {
    const current = { phases: { revelation: [{ type: 'text', markup: 'editado' }] } }

    const { blocks } = applyWidgetGoals(current, {
      phases: { revelation: [{ type: 'text', markup: 'antes' }, seedWidget] },
    })

    expect(blocks.phases?.revelation).toEqual([{ type: 'text', markup: 'editado' }, seedWidget])
  })

  it('é idempotente: widget que já tem missão não é tocado', () => {
    const first = applyWidgetGoals({ phases: { revelation: [{ type: 'text' }] } }, seed)
    const second = applyWidgetGoals(first.blocks, seed)

    expect(first.changed).toBe(1)
    expect(second.changed).toBe(0)
    expect(second.blocks).toEqual(first.blocks)
  })
})

describe('missões do seed (LJ.3.2)', () => {
  it('toda lição do seed continua dentro do contrato, e as missões esperadas existem', () => {
    const found: string[] = []
    for (const lesson of LESSON_SEEDS) {
      if (!lesson.blocks) continue
      expect(lessonBlocksSchema.safeParse(lesson.blocks).success, lesson.code).toBe(true)
      for (const list of Object.values(lesson.blocks.phases)) {
        for (const block of list) {
          if (block.type === 'widget' && block.goal) found.push(`${lesson.code}:${block.id}`)
        }
      }
    }
    expect(found).toEqual(
      expect.arrayContaining([
        '0.2:calculadora',
        '0.4:rendimento-real',
        '0.5:juro-real',
        '0.6:poupanca-vs-tesouro',
      ]),
    )
  })
})
