import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { HasReviewedOldLessonTodayUseCase } from './hasReviewedOldLessonToday'

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

describe('HasReviewedOldLessonTodayUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('false quando o usuário nunca revisou nenhuma lição', async () => {
    const repository = createFakeLessonRepository([lesson])
    const useCase = new HasReviewedOldLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })

  it('true quando revisou hoje uma lição concluída há mais de 14 dias', async () => {
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-08-01T12:00:00Z'),
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T15:00:00Z'))
    await repository.markReviewed('u1', 'l1', new Date())
    const useCase = new HasReviewedOldLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(true)
  })

  it('false quando a revisão foi em outro dia', async () => {
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-08-01T12:00:00Z'),
    })
    await repository.markReviewed('u1', 'l1', new Date('2026-08-20T12:00:00Z'))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T15:00:00Z'))
    const useCase = new HasReviewedOldLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })

  it('false quando revisou hoje uma lição concluída há menos de 14 dias', async () => {
    const repository = createFakeLessonRepository([lesson])
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T15:00:00Z'))
    await repository.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-08-20T12:00:00Z'),
    })
    await repository.markReviewed('u1', 'l1', new Date())
    const useCase = new HasReviewedOldLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })
})
