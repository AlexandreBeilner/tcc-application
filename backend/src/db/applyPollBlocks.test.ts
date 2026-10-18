import { describe, expect, it } from 'vitest'
import { applyPollBlocks } from './pollBlocksMigration'
import { LESSON_SEEDS } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'
import { countMainPathCards } from '../content/contentRules'

const text = (markup: string) => ({ type: 'text', markup })
const poll = { type: 'poll', id: 'p', prompt: 'Qual?', options: ['a', 'b'] }

describe('applyPollBlocks', () => {
  it('insere a enquete depois do bloco que a antecede no seed', () => {
    const current = { summary: ['editado'], phases: { scenario: [text('a'), text('b')] } }
    const seed = { phases: { scenario: [text('a'), poll, text('b')] } }

    const { blocks, added } = applyPollBlocks(current, seed)

    expect(added).toBe(1)
    expect(blocks.phases?.scenario).toEqual([text('a'), poll, text('b')])
    expect(blocks.summary).toEqual(['editado'])
  })

  it('na mesma posição quando o bloco anterior foi reescrito, limitada ao tamanho da fase', () => {
    const seed = { phases: { scenario: [text('a'), text('b'), poll] } }

    expect(applyPollBlocks({ phases: { scenario: [text('x')] } }, seed).blocks.phases).toEqual({
      scenario: [text('x'), poll],
    })
    expect(
      applyPollBlocks({ phases: { scenario: [text('x'), text('y'), text('z'), text('w')] } }, seed)
        .blocks.phases?.scenario?.[2],
    ).toEqual(poll)
  })

  it('é idempotente, mesmo se a enquete já estiver em outra fase', () => {
    const current = { phases: { scenario: [text('a')], revelation: [poll] } }
    const { blocks, added } = applyPollBlocks(current, { phases: { scenario: [text('a'), poll] } })

    expect(added).toBe(0)
    expect(blocks.phases).toEqual(current.phases)
  })

  it('não mexe em lição sem enquete no seed', () => {
    const current = { phases: { scenario: [text('a')] } }
    expect(applyPollBlocks(current, { phases: { scenario: [text('a')] } })).toEqual({
      blocks: current,
      added: 0,
    })
  })
})

describe('enquetes no seed (LJ.2.7)', () => {
  const polls = LESSON_SEEDS.flatMap((seed) =>
    Object.values(
      (seed.blocks as { phases: Record<string, { type: string; id?: string }[]> }).phases,
    )
      .flat()
      .filter((b) => b.type === 'poll')
      .map((b) => ({ code: seed.code, id: b.id })),
  )

  it('as três enquetes da tabela estão nas lições 0.1, 1.3 e 3.4', () => {
    expect(polls).toEqual([
      { code: '0.1', id: 'enquete-bonus' },
      { code: '1.3', id: 'enquete-meses-guardados' },
      { code: '3.4', id: 'enquete-queda-sem-noticia' },
    ])
  })

  it('as lições com enquete seguem válidas e dentro do teto de 15 cartões', () => {
    for (const seed of LESSON_SEEDS) {
      if (!polls.some((p) => p.code === seed.code)) continue
      expect(lessonBlocksSchema.safeParse(seed.blocks).success, seed.code).toBe(true)
      const phases = (seed.blocks as { phases: Record<string, never[]> }).phases
      const cards = Object.values(phases).reduce((sum, list) => sum + countMainPathCards(list), 0)
      expect(cards, seed.code).toBeLessThanOrEqual(15)
    }
  })
})
