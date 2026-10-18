import { describe, expect, it } from 'vitest'
import { applyLessonHook } from './applyLessonHooks'
import { LESSON_HOOKS } from './lessonHooks'
import { LESSON_SEEDS } from './seedLessons'

const hook = { code: 'x', old: 'Definição antiga.', next: 'Pergunta nova? Definição antiga.' }
const text = (markup: string) => ({ type: 'text', markup })

describe('applyLessonHook', () => {
  it('troca o parágrafo antigo e preserva o resto do bloco e da lição', () => {
    const current = {
      summary: ['s'],
      phases: { scenario: [text('Definição antiga.\n\nSegundo.')], revelation: [] },
    }

    const { blocks, changed } = applyLessonHook(current, hook)

    expect(changed).toBe(1)
    expect(blocks.phases?.scenario?.[0]).toEqual(
      text('Pergunta nova? Definição antiga.\n\nSegundo.'),
    )
    expect(blocks.summary).toEqual(['s'])
  })

  it('é idempotente mesmo quando o gancho novo contém o texto antigo', () => {
    const once = applyLessonHook({ phases: { scenario: [text('Definição antiga.')] } }, hook).blocks
    const twice = applyLessonHook(once, hook)
    expect(twice.changed).toBe(0)
    expect(twice.blocks.phases?.scenario?.[0]).toEqual(text('Pergunta nova? Definição antiga.'))
    expect(applyLessonHook({ phases: { scenario: [text('Outro texto.')] } }, hook).changed).toBe(0)
  })
})

describe('ganchos de abertura no seed (LJ.5.8)', () => {
  const firstCard = (code: string) => {
    const seed = LESSON_SEEDS.find((s) => s.code === code)
    const first = seed?.blocks?.phases.scenario[0]
    return first?.type === 'text' ? first.markup : ''
  }

  it('cada gancho está no seed e o texto antigo não sobrou', () => {
    for (const h of LESSON_HOOKS) {
      expect(firstCard(h.code), h.code).toContain(h.next)
      expect(firstCard(h.code).replace(h.next, ''), h.code).not.toContain(h.old)
    }
  })

  it('nenhum gancho passa do teto do cartão nem usa travessão', () => {
    for (const h of LESSON_HOOKS) {
      expect(h.next.length, h.code).toBeLessThanOrEqual(420)
      expect(h.next, h.code).not.toContain('—')
    }
  })

  // "Nenhuma lição abre com 'X é...'": o primeiro cartão não começa com uma definição do tipo "O/Um/Uma ... é ...".
  it('nenhuma lição abre com uma definição', () => {
    const definition = /^(O|A|Um|Uma|Os|As)\s+[^.?!,]{1,60}\s(é|são)\s/
    const offenders = LESSON_SEEDS.filter((s) => {
      const first = s.blocks?.phases.scenario[0]
      return first?.type === 'text' && definition.test(first.markup.split('\n\n')[0])
    }).map((s) => s.code)
    expect(offenders).toEqual([])
  })
})
