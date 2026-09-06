import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { HasCompletedLessonTodayUseCase } from './hasCompletedLessonToday'

const lesson = {
  id: 'l1',
  code: '0.1',
  title: 'Lição 0.1',
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: 1,
  centralConcept: 'x',
  unlocksDescription: null,
  unlocksKeys: [],
}

describe('HasCompletedLessonTodayUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('false quando o usuário nunca concluiu nenhuma lição', async () => {
    const repository = createFakeLessonRepository([lesson])
    const useCase = new HasCompletedLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })

  it('true quando a lição foi concluída hoje', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T15:00:00Z'))
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })
    const useCase = new HasCompletedLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(true)
  })

  it('false quando a lição foi concluída em outro dia', async () => {
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-08-20T12:00:00Z'),
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T15:00:00Z'))
    const useCase = new HasCompletedLessonTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })
})
