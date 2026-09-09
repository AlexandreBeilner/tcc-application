import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetUnlockedProductKeysUseCase } from './getUnlockedProductKeys'

const lesson01 = {
  id: 'l1',
  code: '0.1',
  title: 'O que é investir',
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: 1,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: 'Acesso ao Portfólio',
  unlocksKeys: ['portfolio'],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

const lesson02 = {
  id: 'l2',
  code: '0.2',
  title: 'Juros simples vs compostos',
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: 2,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: 'Calculadora Financeira',
  unlocksKeys: ['calculator'],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

describe('GetUnlockedProductKeysUseCase', () => {
  it('nenhuma lição concluída → conjunto vazio', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    const useCase = new GetUnlockedProductKeysUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual(new Set())
  })

  it('só as chaves das lições já concluídas (mesmo critério de sortOrder<=completedCount)', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.upsertProgress('u1', lesson01.id, { currentStep: 3, completedAt: new Date() })
    const useCase = new GetUnlockedProductKeysUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual(new Set(['portfolio']))
  })

  it('usuário diferente não herda o desbloqueio de outro', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.upsertProgress('u1', lesson01.id, { currentStep: 3, completedAt: new Date() })
    const useCase = new GetUnlockedProductKeysUseCase(repository)

    expect(await useCase.execute({ userId: 'u2' })).toEqual(new Set())
  })
})
