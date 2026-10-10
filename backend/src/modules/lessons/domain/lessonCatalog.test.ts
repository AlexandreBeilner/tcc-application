import { describe, expect, it } from 'vitest'
import { buildCatalogLesson, LESSON_IDS } from '../test/fakes/lessonFixtures'
import { buildLessonFunnel, prerequisiteCodes } from './lessonCatalog'

const counts = {
  started: 10,
  completed: 6,
  avgSecondsToComplete: 120,
  medianSecondsToComplete: 90,
  betAnswered: 5,
  betCorrect: 4,
  abandonedByStep: [1, 2, 1, 0],
}

describe('buildLessonFunnel', () => {
  it('deriva taxa de conclusão, acerto da aposta e total de abandono', () => {
    const funnel = buildLessonFunnel(counts)

    expect(funnel.completionRate).toBeCloseTo(0.6)
    expect(funnel.betAccuracy).toBeCloseTo(0.8)
    expect(funnel.abandoned).toBe(4)
    expect(funnel.medianSecondsToComplete).toBe(90)
  })

  it('devolve null (sem dados) quando ninguém iniciou ou a lição não tem aposta respondida', () => {
    const funnel = buildLessonFunnel({
      ...counts,
      started: 0,
      completed: 0,
      betAnswered: 0,
      betCorrect: 0,
      abandonedByStep: [0, 0, 0, 0],
    })

    expect(funnel.completionRate).toBeNull()
    expect(funnel.betAccuracy).toBeNull()
    expect(funnel.abandoned).toBe(0)
  })
})

describe('prerequisiteCodes', () => {
  it('o pré-requisito é a publicada anterior na ordem, e despublicada fica fora da cadeia', () => {
    const a = buildCatalogLesson({ id: LESSON_IDS.a, code: '0.1', sortOrder: 1 })
    const b = buildCatalogLesson({ id: LESSON_IDS.b, code: '0.2', sortOrder: 2, published: false })
    const c = buildCatalogLesson({ id: LESSON_IDS.c, code: '0.3', sortOrder: 3 })

    const result = prerequisiteCodes([c, b, a])

    expect(result.get(LESSON_IDS.a)).toBeNull()
    expect(result.has(LESSON_IDS.b)).toBe(false)
    expect(result.get(LESSON_IDS.c)).toBe('0.1')
  })
})
