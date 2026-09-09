import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { HasMicroDecisionStreakTodayUseCase } from './hasMicroDecisionStreakToday'

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
const lesson03 = { ...baseLesson, id: 'l3', code: '0.3', sortOrder: 3 }

const TODAY = new Date('2026-09-10T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HasMicroDecisionStreakTodayUseCase', () => {
  it('menos de 3 acertos seguidos hoje → false', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson01.id,
      3,
      new Date('2026-09-10T08:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson02.id,
      3,
      new Date('2026-09-10T09:00:00Z'),
      1,
    )
    const useCase = new HasMicroDecisionStreakTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })

  it('3 acertos seguidos hoje → true', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson03])
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson01.id,
      3,
      new Date('2026-09-10T08:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson02.id,
      3,
      new Date('2026-09-10T09:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson03.id,
      3,
      new Date('2026-09-10T10:00:00Z'),
      1,
    )
    const useCase = new HasMicroDecisionStreakTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(true)
  })

  it('erro no meio do dia zera a contagem — não basta ter 3 acertos espalhados', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson03])
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson01.id,
      3,
      new Date('2026-09-10T08:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson02.id,
      3,
      new Date('2026-09-10T09:00:00Z'),
      0,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson03.id,
      3,
      new Date('2026-09-10T10:00:00Z'),
      1,
    )
    const useCase = new HasMicroDecisionStreakTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })

  it('sequência de ontem não carrega pra hoje', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson03])
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson01.id,
      3,
      new Date('2026-09-09T08:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson02.id,
      3,
      new Date('2026-09-09T09:00:00Z'),
      1,
    )
    await repository.completeIfNotAlreadyCompleted(
      'u1',
      lesson03.id,
      3,
      new Date('2026-09-10T08:00:00Z'),
      1,
    )
    const useCase = new HasMicroDecisionStreakTodayUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(false)
  })
})
