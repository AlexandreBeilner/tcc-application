import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { ExportLessonProgressUseCase } from './exportLessonProgress'

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
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

describe('ExportLessonProgressUseCase', () => {
  it('devolve o progresso de todas as lições do usuário', async () => {
    const repository = createFakeLessonRepository([lesson])
    await repository.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-08-20T00:00:00Z'),
    })
    const useCase = new ExportLessonProgressUseCase(repository)

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual([
      { lessonId: 'l1', currentStep: 3, completedAt: new Date('2026-08-20T00:00:00Z') },
    ])
  })

  it('lista vazia pra usuário sem nenhum progresso', async () => {
    const repository = createFakeLessonRepository([lesson])
    const useCase = new ExportLessonProgressUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([])
  })
})
