import { describe, expect, it } from 'vitest'
import { applyMoreBlocks } from './applyMoreBlocks'
import { LESSON_SEEDS } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'
import { countMainPathCards } from '../content/contentRules'

const text = (markup: string) => ({ type: 'text', markup })
const more = {
  type: 'more',
  id: 'm',
  title: 'T',
  blocks: [text('detalhe'), { type: 'widget', id: 'w' }],
}

describe('applyMoreBlocks', () => {
  it('move texto e widget para o "Saiba mais", depois do bloco que o antecede no seed', () => {
    const current = {
      summary: ['editado'],
      phases: {
        revelation: [text('a'), text('detalhe'), { type: 'widget', id: 'w' }, text('b')],
      },
    }
    const seed = { phases: { revelation: [text('a'), more, text('b')] } }

    const { blocks, moved } = applyMoreBlocks(current, seed)

    expect(moved).toBe(2)
    expect(blocks.phases?.revelation).toEqual([text('a'), more, text('b')])
    expect(blocks.summary).toEqual(['editado'])
  })

  it('segue a ordem do seed quando o detalhe estava em outro ponto da fase', () => {
    const q = { type: 'check', id: 'q' }
    const current = { phases: { revelation: [text('a'), q, text('detalhe'), text('b')] } }
    const seed = {
      phases: { revelation: [text('a'), { ...more, blocks: [text('detalhe')] }, q, text('b')] },
    }

    const { blocks } = applyMoreBlocks(current, seed)

    expect(blocks.phases?.revelation?.map((b) => b.type)).toEqual(['text', 'more', 'check', 'text'])
  })

  it('é idempotente: "Saiba mais" que já existe não é tocado', () => {
    const current = { phases: { revelation: [text('a'), more] } }

    const { blocks, moved } = applyMoreBlocks(current, {
      phases: { revelation: [text('a'), more] },
    })

    expect(moved).toBe(0)
    expect(blocks.phases?.revelation).toEqual([text('a'), more])
  })

  it('não insere nada quando o conteúdo que ele guardaria não existe mais (evita duplicar)', () => {
    const current = { phases: { revelation: [text('a'), text('reescrito')] } }

    const { blocks, moved } = applyMoreBlocks(current, {
      phases: { revelation: [text('a'), more] },
    })

    expect(moved).toBe(0)
    expect(blocks.phases?.revelation).toEqual([text('a'), text('reescrito')])
  })

  it('aplicado ao seed antigo, reproduz o seed novo (nada some, só muda de lugar)', () => {
    for (const seed of LESSON_SEEDS) {
      const phases = seed.blocks?.phases
      if (!phases) continue
      const flat = (list: unknown[]) =>
        list.flatMap((b) =>
          (b as { type: string }).type === 'more' ? (b as { blocks: unknown[] }).blocks : [b],
        )
      const old = Object.fromEntries(
        Object.entries(phases).map(([phase, list]) => [phase, flat(list)]),
      )
      const { blocks } = applyMoreBlocks({ phases: old } as never, seed.blocks as never)
      expect(blocks.phases, `lição ${seed.code}`).toEqual(phases)
      expect(lessonBlocksSchema.safeParse({ ...seed.blocks, phases: blocks.phases }).success).toBe(
        true,
      )
    }
  })

  it('o "Saiba mais" tira cartões do caminho principal', () => {
    const before = countMainPathCards([text('a'), text('detalhe'), { type: 'widget', id: 'w' }])
    const after = countMainPathCards([text('a'), more])
    expect([before, after]).toEqual([3, 1])
  })
})
