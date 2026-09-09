import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetTracksCompletedWithoutErrorsCountUseCase } from './getTracksCompletedWithoutErrorsCount'

const baseLesson = {
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
  microDecisionOptions: ['A', 'B'],
  microDecisionCorrectOption: 1,
}

const lesson01 = baseLesson
const lesson02 = { ...baseLesson, id: 'l2', code: '0.2', sortOrder: 2 }
const lesson11 = { ...baseLesson, id: 'l3', code: '1.1', trackNumber: 1, sortOrder: 3 }

describe('GetTracksCompletedWithoutErrorsCountUseCase', () => {
  it('trilha completa e sem erro conta 1', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date(), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date(), 1)
    const useCase = new GetTracksCompletedWithoutErrorsCountUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(1)
  })

  it('erro numa lição da trilha exclui a trilha inteira', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date(), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date(), 0)
    const useCase = new GetTracksCompletedWithoutErrorsCountUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(0)
  })

  it('conta só as trilhas completas sem erro, ignorando as incompletas', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson11])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date(), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date(), 1)
    const useCase = new GetTracksCompletedWithoutErrorsCountUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(1)
  })
})
