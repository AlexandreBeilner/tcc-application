import { describe, expect, it } from 'vitest'
import { LessonNotCompletedError, LessonNotFoundError } from '../../domain/errors'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { ReviewLessonUseCase } from './reviewLesson'

const lesson = {
  id: 'l1',
  code: '0.1',
  title: 'Lição 0.1',
  trackNumber: 0,
  trackName: 'Trilha 0',
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
}

describe('ReviewLessonUseCase', () => {
  it('lança LessonNotFoundError pra lição inexistente', async () => {
    const repository = createFakeLessonRepository([])
    const useCase = new ReviewLessonUseCase(repository)

    await expect(useCase.execute({ userId: 'u1', lessonId: 'nope' })).rejects.toThrow(
      LessonNotFoundError,
    )
  })

  it('lança LessonNotCompletedError quando a lição nunca foi concluída', async () => {
    const repository = createFakeLessonRepository([lesson])
    const useCase = new ReviewLessonUseCase(repository)

    await expect(useCase.execute({ userId: 'u1', lessonId: 'l1' })).rejects.toThrow(
      LessonNotCompletedError,
    )
  })

  it('lança LessonNotCompletedError quando o usuário só tem progresso em andamento', async () => {
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })
    const useCase = new ReviewLessonUseCase(repository)

    await expect(useCase.execute({ userId: 'u1', lessonId: 'l1' })).rejects.toThrow(
      LessonNotCompletedError,
    )
  })

  it('marca lastReviewedAt sem mexer em currentStep/completedAt', async () => {
    const repository = createFakeLessonRepository([lesson])
    const completedAt = new Date('2026-08-01T12:00:00Z')
    await repository.upsertProgress('u1', 'l1', { currentStep: 3, completedAt })
    const useCase = new ReviewLessonUseCase(repository)

    await useCase.execute({ userId: 'u1', lessonId: 'l1' })

    const [progress] = await repository.listProgressForUser('u1')
    expect(progress.completedAt).toEqual(completedAt)
    expect(progress.currentStep).toBe(3)
    expect(progress.lastReviewedAt).not.toBeNull()
  })
})
