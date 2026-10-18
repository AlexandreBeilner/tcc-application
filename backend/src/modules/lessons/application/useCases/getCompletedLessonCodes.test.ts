import { describe, expect, it } from 'vitest'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetCompletedLessonCodesUseCase } from './getCompletedLessonCodes'

const lesson = (n: number): LessonSummary => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição ${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: n,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection',
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: null,
  unlocksKeys: [],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
  blocks: null,
})

describe('GetCompletedLessonCodesUseCase', () => {
  it('devolve os códigos das lições concluídas, na ordem do currículo, só da pessoa pedida', async () => {
    const repository = createFakeLessonRepository([lesson(1), lesson(2), lesson(3)])
    await repository.upsertProgress('u1', 'l3', { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })
    await repository.upsertProgress('u1', 'l2', { currentStep: 1, completedAt: null })
    await repository.upsertProgress('u2', 'l2', { currentStep: 3, completedAt: new Date() })

    const codes = await new GetCompletedLessonCodesUseCase(repository).execute({ userId: 'u1' })

    expect(codes).toEqual(['0.1', '0.3'])
  })

  it('lição só dispensada não conta, e sem progresso a lista é vazia', async () => {
    const repository = createFakeLessonRepository([lesson(1), lesson(2)])
    repository.waive('u1', 'l1')

    expect(await new GetCompletedLessonCodesUseCase(repository).execute({ userId: 'u1' })).toEqual(
      [],
    )
    expect(
      await new GetCompletedLessonCodesUseCase(repository).execute({ userId: 'nobody' }),
    ).toEqual([])
  })
})
