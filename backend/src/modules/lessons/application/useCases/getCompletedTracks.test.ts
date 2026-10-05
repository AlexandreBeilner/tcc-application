import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetCompletedTracksUseCase } from './getCompletedTracks'

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

const lesson11 = {
  ...lesson01,
  id: 'l3',
  code: '1.1',
  trackNumber: 1,
  trackName: 'Trilha 1: Renda Fixa',
  sortOrder: 3,
}

describe('GetCompletedTracksUseCase', () => {
  it('nenhuma lição concluída → nenhuma trilha completa', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson11])
    const useCase = new GetCompletedTracksUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([])
  })

  it('só a trilha com todas as lições concluídas entra no resultado', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson11])
    await repository.upsertProgress('u1', lesson01.id, { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', lesson02.id, { currentStep: 3, completedAt: new Date() })
    const useCase = new GetCompletedTracksUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([0])
  })

  it('usuário diferente não herda a trilha completa de outro', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.upsertProgress('u1', lesson01.id, { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', lesson02.id, { currentStep: 3, completedAt: new Date() })
    const useCase = new GetCompletedTracksUseCase(repository)

    expect(await useCase.execute({ userId: 'u2' })).toEqual([])
  })
  it('lição dispensada conta como satisfeita: troféu não regride com lição nova no meio (N.24)', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.upsertProgress('u1', lesson01.id, { currentStep: 3, completedAt: new Date() })
    repository.waive('u1', lesson02.id)
    const useCase = new GetCompletedTracksUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([0])
  })
})
