import { describe, expect, it } from 'vitest'
import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetLessonUseCase } from './getLesson'

const lessons = [1, 2].map((n) => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0 — Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  unlocksDescription: null,
}))

describe('GetLessonUseCase', () => {
  it('rejeita id inexistente com LessonNotFoundError (404 no router)', async () => {
    const repository = createFakeLessonRepository(lessons)
    const useCase = new GetLessonUseCase(repository)

    await expect(useCase.execute({ userId: 'u1', lessonId: 'nope' })).rejects.toBeInstanceOf(
      LessonNotFoundError,
    )
  })

  it('rejeita lição ainda bloqueada com LessonLockedError (404 no router)', async () => {
    const repository = createFakeLessonRepository(lessons)
    const useCase = new GetLessonUseCase(repository)

    await expect(useCase.execute({ userId: 'u1', lessonId: 'l2' })).rejects.toBeInstanceOf(
      LessonLockedError,
    )
  })

  it('retorna a lição disponível com progresso pra retomar', async () => {
    const repository = createFakeLessonRepository(lessons)
    await repository.upsertProgress('u1', 'l1', { currentStep: 2, completedAt: null })
    const useCase = new GetLessonUseCase(repository)

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1' })

    expect(result.status).toBe('available')
    expect(result.currentStep).toBe(2)
  })
})
