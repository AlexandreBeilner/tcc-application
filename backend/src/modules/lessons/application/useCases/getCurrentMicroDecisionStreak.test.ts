import { describe, expect, it } from 'vitest'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetCurrentMicroDecisionStreakUseCase } from './getCurrentMicroDecisionStreak'

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
// Sem aposta real (checkbox de hoje) — não deve quebrar nem contar a sequência.
const lesson04 = {
  ...baseLesson,
  id: 'l4',
  code: '0.4',
  sortOrder: 4,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

describe('GetCurrentMicroDecisionStreakUseCase', () => {
  it('sem nenhuma lição concluída → 0', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    const useCase = new GetCurrentMicroDecisionStreakUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(0)
  })

  it('conta os acertos seguidos, ordenados por completedAt', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02, lesson03])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date('2026-09-01'), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date('2026-09-02'), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson03.id, 3, new Date('2026-09-03'), 1)
    const useCase = new GetCurrentMicroDecisionStreakUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(3)
  })

  it('erro mais recente zera a sequência', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson02])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date('2026-09-01'), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson02.id, 3, new Date('2026-09-02'), 0)
    const useCase = new GetCurrentMicroDecisionStreakUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(0)
  })

  it('lição sem aposta real não conta nem quebra a sequência', async () => {
    const repository = createFakeLessonRepository([lesson01, lesson04])
    await repository.completeIfNotAlreadyCompleted('u1', lesson01.id, 3, new Date('2026-09-01'), 1)
    await repository.completeIfNotAlreadyCompleted('u1', lesson04.id, 3, new Date('2026-09-02'))
    const useCase = new GetCurrentMicroDecisionStreakUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toBe(1)
  })
})
