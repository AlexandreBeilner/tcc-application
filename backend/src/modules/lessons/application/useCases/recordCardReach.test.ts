import { describe, expect, it } from 'vitest'
import {
  InvalidCardPositionError,
  LessonLockedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
} from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonCardReachRepository } from '../../test/fakes/fakeLessonCardReachRepository'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { RecordCardReachUseCase } from './recordCardReach'

const first: LessonSummary = {
  id: 'l1',
  code: '0.1',
  title: 'Lição',
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: 1,
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
}
const second: LessonSummary = { ...first, id: 'l2', code: '0.2', sortOrder: 2 }
const NOW = new Date('2026-10-18T12:00:00Z')

function setup() {
  const lessons = createFakeLessonRepository([first, second])
  const reach = createFakeLessonCardReachRepository()
  const useCase = new RecordCardReachUseCase(lessons, reach, () => NOW)
  return { lessons, reach, useCase }
}

describe('RecordCardReachUseCase', () => {
  it('conta a chegada a um cartão uma vez por pessoa', async () => {
    const { reach, useCase } = setup()
    const input = { userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 0 }

    expect(await useCase.execute(input)).toEqual({ recorded: true })
    expect(await useCase.execute(input)).toEqual({ recorded: false })
    expect(await reach.listReach('l1', '2026-10-18')).toEqual([
      { phase: 0, cardIndex: 0, reached: 1 },
    ])
  })

  it('voltar a um cartão anterior não conta de novo', async () => {
    const { reach, useCase } = setup()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 0 })
    await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 1 })

    expect(await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 0 })).toEqual(
      {
        recorded: false,
      },
    )
    expect(await reach.listReach('l1', '2026-10-18')).toHaveLength(2)
  })

  it('pessoas diferentes contam separado no mesmo cartão', async () => {
    const { reach, useCase } = setup()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 0 })
    await useCase.execute({ userId: 'u2', lessonId: 'l1', phase: 0, cardIndex: 0 })

    expect(await reach.listReach('l1', '2026-10-18')).toEqual([
      { phase: 0, cardIndex: 0, reached: 2 },
    ])
  })

  it('recusa posição fora dos limites do player', async () => {
    const { useCase } = setup()
    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 4, cardIndex: 0 }),
    ).rejects.toBeInstanceOf(InvalidCardPositionError)
    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 500 }),
    ).rejects.toBeInstanceOf(InvalidCardPositionError)
  })

  it('recusa lição inexistente e lição bloqueada', async () => {
    const { useCase } = setup()
    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'nope', phase: 0, cardIndex: 0 }),
    ).rejects.toBeInstanceOf(LessonNotFoundError)
    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'l2', phase: 0, cardIndex: 0 }),
    ).rejects.toBeInstanceOf(LessonLockedError)
  })

  it('recusa fase além do passo que o servidor gravou', async () => {
    const { lessons, useCase } = setup()
    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 2, cardIndex: 0 }),
    ).rejects.toBeInstanceOf(LessonStepOutOfOrderError)

    await lessons.upsertProgress('u1', 'l1', { currentStep: 2, completedAt: null })
    expect(await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 2, cardIndex: 0 })).toEqual(
      {
        recorded: true,
      },
    )
  })

  it('a tela final entra no funil: a lição já está concluída no servidor quando ela aparece', async () => {
    const { lessons, reach, useCase } = setup()
    await lessons.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: NOW })

    expect(await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 3, cardIndex: 0 })).toEqual(
      {
        recorded: true,
      },
    )
    expect(await useCase.execute({ userId: 'u1', lessonId: 'l1', phase: 0, cardIndex: 0 })).toEqual(
      {
        recorded: false,
      },
    )
    expect(await reach.listReach('l1', '2026-10-01')).toEqual([
      { phase: 3, cardIndex: 0, reached: 1 },
    ])
  })
})
