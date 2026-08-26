import { describe, expect, it } from 'vitest'
import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import { LESSON_UNLOCK_STEP, LESSON_XP_REWARD } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { AdvanceLessonUseCase } from './advanceLesson'

const lessons = [1, 2].map((n) => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0 — Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  unlocksDescription: null,
}))

function build() {
  const lessonRepository = createFakeLessonRepository(lessons)
  const xpAwarder = createFakeXpAwarder()
  const streakTracker = createFakeStreakTracker()
  const useCase = new AdvanceLessonUseCase(lessonRepository, xpAwarder, streakTracker)
  return { lessonRepository, xpAwarder, streakTracker, useCase }
}

describe('AdvanceLessonUseCase', () => {
  it('grava currentStep sem concluir antes do step de desbloqueio', async () => {
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: 1 })

    expect(result).toEqual({ currentStep: 1, completed: false })
  })

  it('conclui, credita xp e toca o streak ao chegar no step de desbloqueio, na primeira vez', async () => {
    const { xpAwarder, streakTracker, useCase } = build()

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    expect(result).toEqual({ currentStep: LESSON_UNLOCK_STEP, completed: true })
    expect(xpAwarder.awarded).toEqual([
      { userId: 'u1', amount: LESSON_XP_REWARD, reason: 'licao:0.1' },
    ])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('reabrir lição já concluída (modo revisão) não credita xp nem afeta streak de novo', async () => {
    const { xpAwarder, streakTracker, useCase } = build()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: 1 })

    expect(result).toEqual({ currentStep: 1, completed: true })
    expect(xpAwarder.awarded).toHaveLength(1)
    expect(streakTracker.touchedUserIds).toHaveLength(1)
  })

  it('reenviar o step de desbloqueio de novo (mesma lição) não credita xp duas vezes', async () => {
    const { xpAwarder, streakTracker, useCase } = build()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    expect(xpAwarder.awarded).toHaveLength(1)
    expect(streakTracker.touchedUserIds).toHaveLength(1)
  })

  it('rejeita avançar lição ainda bloqueada', async () => {
    const { useCase } = build()

    await expect(useCase.execute({ userId: 'u1', lessonId: 'l2', step: 0 })).rejects.toBeInstanceOf(
      LessonLockedError,
    )
  })

  it('rejeita lição inexistente', async () => {
    const { useCase } = build()

    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'nope', step: 0 }),
    ).rejects.toBeInstanceOf(LessonNotFoundError)
  })
})
