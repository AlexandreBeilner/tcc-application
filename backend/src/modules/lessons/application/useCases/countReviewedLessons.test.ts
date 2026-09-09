import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { CountReviewedLessonsUseCase } from './countReviewedLessons'

const lesson01 = {
  id: 'l1',
  code: '0.1',
  title: 'O que é investir',
  trackNumber: 0,
  trackName: 'Trilha 0: Fundamentos',
  sortOrder: 1,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: null,
  unlocksKeys: [],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

const lesson02 = { ...lesson01, id: 'l2', code: '0.2', sortOrder: 2 }

describe('CountReviewedLessonsUseCase', () => {
  it('sem nenhuma revisão → 0', async () => {
    const repository = createFakeLessonRepository([lesson01])
    const useCase = new CountReviewedLessonsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(0)
  })

  it('conta lições distintas já revisadas ao menos uma vez', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date('2026-08-01'))
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date('2026-08-01'))
    await repository.markReviewed('u1', lesson01.id, new Date('2026-09-01'))
    const useCase = new CountReviewedLessonsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(1)
  })
})
