import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { CountCompletedLessonsUseCase } from './countCompletedLessons'

const lessons = [
  {
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
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
  },
  {
    id: 'l2',
    code: '0.2',
    title: 'Lição 0.2',
    trackNumber: 0,
    trackName: 'Trilha 0',
    sortOrder: 2,
    centralConcept: 'y',
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
  },
]

describe('CountCompletedLessonsUseCase', () => {
  it('0 pra usuário sem nenhuma lição concluída', async () => {
    const repository = createFakeLessonRepository(lessons)
    const useCase = new CountCompletedLessonsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(0)
  })

  it('conta só lições com completedAt preenchido, ignora em progresso', async () => {
    const repository = createFakeLessonRepository(lessons)
    await repository.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', 'l2', { currentStep: 1, completedAt: null })
    const useCase = new CountCompletedLessonsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(1)
  })
})
