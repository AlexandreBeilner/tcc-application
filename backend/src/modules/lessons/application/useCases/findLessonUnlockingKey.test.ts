import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { FindLessonUnlockingKeyUseCase } from './findLessonUnlockingKey'

const lesson12 = {
  id: 'l1-2',
  code: '1.2',
  title: 'Tesouro Selic',
  trackNumber: 1,
  trackName: 'Trilha 1: Renda Fixa',
  sortOrder: 7,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: 'Tesouro Selic',
  unlocksKeys: ['asset:tesouro_selic'],
  unlocksAssetTicker: 'LFT2029',
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

describe('FindLessonUnlockingKeyUseCase', () => {
  it('devolve code/title da lição cujo unlocksKeys contém a chave', async () => {
    const repository = createFakeLessonRepository([lesson12])
    const useCase = new FindLessonUnlockingKeyUseCase(repository)

    expect(await useCase.execute({ key: 'asset:tesouro_selic' })).toEqual({
      code: '1.2',
      title: 'Tesouro Selic',
    })
  })

  it('undefined quando nenhuma lição desbloqueia a chave', async () => {
    const repository = createFakeLessonRepository([lesson12])
    const useCase = new FindLessonUnlockingKeyUseCase(repository)

    expect(await useCase.execute({ key: 'asset:acao' })).toBeUndefined()
  })
})
