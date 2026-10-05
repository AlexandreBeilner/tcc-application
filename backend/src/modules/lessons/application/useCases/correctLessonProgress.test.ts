import { describe, expect, it } from 'vitest'
import {
  LessonAlreadyCompletedError,
  LessonNotFoundError,
  LessonNotReopenableError,
} from '../../domain/errors'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { MarkLessonCompletedUseCase, ReopenLessonUseCase } from './correctLessonProgress'

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

const now = new Date('2026-10-03T12:00:00Z')

function build() {
  const repository = createFakeLessonRepository([lesson])
  return {
    repository,
    complete: new MarkLessonCompletedUseCase(repository, () => now),
    reopen: new ReopenLessonUseCase(repository),
  }
}

describe('MarkLessonCompletedUseCase', () => {
  it('conclui uma lição que o usuário nunca abriu, no passo de desbloqueio', async () => {
    const { complete, repository } = build()

    await complete.execute('u1', 'l1')

    const [own] = await repository.listProgressForUser('u1')
    expect(own).toMatchObject({
      lessonId: 'l1',
      currentStep: LESSON_UNLOCK_STEP,
      completedAt: now,
    })
  })

  it('conclui uma lição em andamento sem recuar o passo já alcançado', async () => {
    const { complete, repository } = build()
    await repository.upsertProgress('u1', 'l1', { currentStep: 4, completedAt: null })

    await complete.execute('u1', 'l1')

    const [own] = await repository.listProgressForUser('u1')
    expect(own).toMatchObject({ currentStep: 4, completedAt: now })
  })

  it('recusa lição inexistente e lição já concluída', async () => {
    const { complete, repository } = build()

    await expect(complete.execute('u1', 'nope')).rejects.toBeInstanceOf(LessonNotFoundError)
    await repository.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: now })
    await expect(complete.execute('u1', 'l1')).rejects.toBeInstanceOf(LessonAlreadyCompletedError)
  })
})

describe('ReopenLessonUseCase', () => {
  it('limpa a conclusão e volta pro passo 0', async () => {
    const { reopen, repository } = build()
    await repository.upsertProgress('u1', 'l1', { currentStep: 4, completedAt: now })

    await reopen.execute('u1', 'l1')

    const [own] = await repository.listProgressForUser('u1')
    expect(own).toMatchObject({ currentStep: 0, completedAt: null })
  })

  it('recusa lição inexistente, nunca aberta e em andamento', async () => {
    const { reopen, repository } = build()

    await expect(reopen.execute('u1', 'nope')).rejects.toBeInstanceOf(LessonNotFoundError)
    await expect(reopen.execute('u1', 'l1')).rejects.toBeInstanceOf(LessonNotReopenableError)
    await repository.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })
    await expect(reopen.execute('u1', 'l1')).rejects.toBeInstanceOf(LessonNotReopenableError)
  })
})
