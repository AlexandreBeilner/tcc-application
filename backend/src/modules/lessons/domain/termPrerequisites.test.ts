import { describe, expect, it } from 'vitest'
import { findTermViolations, type TermRule } from './termPrerequisites'

const rule: TermRule = {
  id: 'x',
  label: 'termoX',
  pattern: /termox/i,
  definedIn: 'B',
  glossaryKeys: ['termoX'],
}
const lessons = (texts: Record<string, string>) =>
  Object.entries(texts).map(([code, text], i) => ({ code, sortOrder: i + 1, text }))

describe('findTermViolations', () => {
  it('acusa uso antes da lição que define o termo', () => {
    const v = findTermViolations(
      lessons({ A: 'fala de termoX', B: 'define termoX', C: 'usa termoX' }),
      [rule],
    )
    expect(v.map((x) => x.lessonCode)).toEqual(['A'])
  })

  it('aceita definição inline pelo glossário', () => {
    expect(findTermViolations(lessons({ A: 'fala de {{termoX}}', B: 'define' }), [rule])).toEqual(
      [],
    )
  })

  it('termo sem lição definidora acusa todo uso', () => {
    const planned: TermRule = { ...rule, definedIn: null, plannedIn: 'RC.4.1' }
    const v = findTermViolations(lessons({ A: 'termoX', B: 'termoX' }), [planned])
    expect(v).toHaveLength(2)
    expect(v[0].plannedIn).toBe('RC.4.1')
  })

  it('lição que não usa o termo não é acusada', () => {
    expect(findTermViolations(lessons({ A: 'nada', B: 'termoX' }), [rule])).toEqual([])
  })

  it('lição de trilha paralela não herda definição de lição anterior', () => {
    const list = [
      { code: 'B', sortOrder: 1, text: 'define termoX' },
      { code: 'F', sortOrder: 2, text: 'usa termoX', parallel: true },
    ]
    expect(findTermViolations(list, [rule]).map((x) => x.lessonCode)).toEqual(['F'])
  })
})
