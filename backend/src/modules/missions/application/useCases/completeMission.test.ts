import { describe, expect, it, vi } from 'vitest'
import {
  LessonNotCompletedTodayError,
  MicroDecisionStreakNotReachedError,
  MissionNotFoundError,
  OldLessonNotReviewedTodayError,
} from '../../domain/errors'
import {
  MICRO_DECISION_STREAK_MISSION_KEY,
  REVIEW_OLD_LESSON_MISSION_KEY,
  todayUtc,
} from '../../domain/mission'
import { createFakeLessonCompletionChecker } from '../../test/fakes/fakeLessonCompletionChecker'
import { createFakeLessonReviewChecker } from '../../test/fakes/fakeLessonReviewChecker'
import { createFakeMicroDecisionStreakChecker } from '../../test/fakes/fakeMicroDecisionStreakChecker'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { CompleteMissionUseCase } from './completeMission'

const lessonMission = {
  id: 'm1',
  key: 'lesson_complete',
  title: 'Complete uma lição da trilha',
  description: null,
  completionCriteria: 'Concluir qualquer lição hoje',
  xpReward: 30,
  requiresLessonCompletion: true,
  isActive: true,
}

const feedMission = {
  id: 'm2',
  key: 'feed_read',
  title: 'Consulte o feed de notícias',
  description: null,
  completionCriteria: 'Abrir o feed de notícias',
  xpReward: 20,
  requiresLessonCompletion: false,
  isActive: true,
}

const reviewMission = {
  id: 'm3',
  key: REVIEW_OLD_LESSON_MISSION_KEY,
  title: 'Revise uma lição concluída há mais de 14 dias',
  description: null,
  completionCriteria: 'Reabrir e revisar hoje uma lição antiga',
  xpReward: 30,
  requiresLessonCompletion: false,
  isActive: true,
}

const streakMission = {
  id: 'm4',
  key: MICRO_DECISION_STREAK_MISSION_KEY,
  title: 'Acerte 3 apostas seguidas hoje',
  description: null,
  completionCriteria: '3 acertos seguidos hoje na Micro-decisão',
  xpReward: 30,
  requiresLessonCompletion: false,
  isActive: true,
}

function build(
  hasCompletedLesson = false,
  hasReviewedOldLesson = false,
  hasMicroDecisionStreak = false,
) {
  const missionRepository = createFakeMissionRepository([
    lessonMission,
    feedMission,
    reviewMission,
    streakMission,
  ])
  const lessonCompletionChecker = createFakeLessonCompletionChecker(hasCompletedLesson)
  const lessonReviewChecker = createFakeLessonReviewChecker(hasReviewedOldLesson)
  const microDecisionStreakChecker = createFakeMicroDecisionStreakChecker(hasMicroDecisionStreak)
  const xpAwarder = createFakeXpAwarder()
  const streakTracker = createFakeStreakTracker()
  const useCase = new CompleteMissionUseCase(
    missionRepository,
    lessonCompletionChecker,
    lessonReviewChecker,
    microDecisionStreakChecker,
    xpAwarder,
    streakTracker,
  )
  return { missionRepository, xpAwarder, streakTracker, useCase }
}

describe('CompleteMissionUseCase', () => {
  it('rejeita missão inexistente', async () => {
    const { useCase } = build()

    await expect(useCase.execute({ userId: 'u1', missionId: 'nope' })).rejects.toBeInstanceOf(
      MissionNotFoundError,
    )
  })

  it('missão "lição concluída" é rejeitada sem nenhuma lição concluída no dia', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false)

    await expect(useCase.execute({ userId: 'u1', missionId: 'm1' })).rejects.toBeInstanceOf(
      LessonNotCompletedTodayError,
    )
    expect(xpAwarder.awarded).toHaveLength(0)
    expect(streakTracker.touchedUserIds).toHaveLength(0)
  })

  it('missão "lição concluída" completa quando o usuário já concluiu uma lição hoje', async () => {
    const { xpAwarder, streakTracker, useCase } = build(true)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm1' })

    expect(result).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 30, reason: 'missao:m1' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('missão "revise uma lição antiga" é rejeitada sem nenhuma revisão elegível hoje', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false, false)

    await expect(useCase.execute({ userId: 'u1', missionId: 'm3' })).rejects.toBeInstanceOf(
      OldLessonNotReviewedTodayError,
    )
    expect(xpAwarder.awarded).toHaveLength(0)
    expect(streakTracker.touchedUserIds).toHaveLength(0)
  })

  it('missão "revise uma lição antiga" completa quando o usuário revisou uma lição antiga hoje', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false, true)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm3' })

    expect(result).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 30, reason: 'missao:m3' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('missão "acerte 3 seguidas" é rejeitada sem a sequência de hoje', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false, false, false)

    await expect(useCase.execute({ userId: 'u1', missionId: 'm4' })).rejects.toBeInstanceOf(
      MicroDecisionStreakNotReachedError,
    )
    expect(xpAwarder.awarded).toHaveLength(0)
    expect(streakTracker.touchedUserIds).toHaveLength(0)
  })

  it('missão "acerte 3 seguidas" completa quando a sequência de hoje foi alcançada', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false, false, true)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm4' })

    expect(result).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 30, reason: 'missao:m4' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('missões sem verificação cruzada aceitam o relato do cliente', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm2' })

    expect(result).toEqual({
      status: 'completed',
      xpAwarded: 20,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 20, reason: 'missao:m2' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('propaga leveledUp, streakMilestone e a união das conquistas devolvidas por xpAwarder/streakTracker', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false)
    xpAwarder.nextResult = {
      xp: 150,
      level: 2,
      leveledUp: true,
      unlockedAchievements: [{ id: 'a1', name: 'Primeiros Passos', description: null }],
    }
    streakTracker.nextResult = {
      currentStreak: 7,
      longestStreak: 7,
      milestoneReached: 7,
      unlockedAchievements: [{ id: 'a2', name: 'Primeira Semana', description: null }],
    }

    const result = await useCase.execute({ userId: 'u1', missionId: 'm2' })

    expect(result).toEqual({
      status: 'completed',
      xpAwarded: 20,
      leveledUp: true,
      newLevel: 2,
      streakMilestone: 7,
      unlockedAchievements: [
        { id: 'a1', name: 'Primeiros Passos', description: null },
        { id: 'a2', name: 'Primeira Semana', description: null },
      ],
    })
  })

  it('conclusão de missão já concluída é idempotente — não credita xp/streak de novo', async () => {
    const { missionRepository, xpAwarder, streakTracker, useCase } = build(false)
    await missionRepository.markCompleted('u1', 'm2', new Date().toISOString().slice(0, 10))

    const result = await useCase.execute({ userId: 'u1', missionId: 'm2' })

    expect(result).toEqual({ status: 'completed' })
    expect(xpAwarder.awarded).toHaveLength(0)
    expect(streakTracker.touchedUserIds).toHaveLength(0)
  })

  it('duas requisições concorrentes só creditam xp uma vez — markCompleted é quem decide, não o findProgress', async () => {
    const { missionRepository, xpAwarder, streakTracker, useCase } = build(false)
    // Simula a janela de corrida: a leitura de `findProgress` desta
    // requisição ainda não enxerga a conclusão que "outra requisição"
    // (o `markCompleted` chamado abaixo, fora do use case) já efetivou no
    // banco — só o claim atômico de `markCompleted` detecta isso de fato.
    await missionRepository.markCompleted('u1', 'm2', todayUtc(new Date()))
    vi.spyOn(missionRepository, 'findProgress').mockResolvedValueOnce(undefined)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm2' })

    expect(result).toEqual({ status: 'completed' })
    expect(xpAwarder.awarded).toHaveLength(0)
    expect(streakTracker.touchedUserIds).toHaveLength(0)
  })
})
