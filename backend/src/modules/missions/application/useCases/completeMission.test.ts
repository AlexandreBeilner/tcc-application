import { describe, expect, it, vi } from 'vitest'
import { LessonNotCompletedTodayError, MissionNotFoundError } from '../../domain/errors'
import { todayUtc } from '../../domain/mission'
import { createFakeLessonCompletionChecker } from '../../test/fakes/fakeLessonCompletionChecker'
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
}

const feedMission = {
  id: 'm2',
  key: 'feed_read',
  title: 'Consulte o feed de notícias',
  description: null,
  completionCriteria: 'Abrir o feed de notícias',
  xpReward: 20,
  requiresLessonCompletion: false,
}

function build(hasCompletedLesson = false) {
  const missionRepository = createFakeMissionRepository([lessonMission, feedMission])
  const lessonCompletionChecker = createFakeLessonCompletionChecker(hasCompletedLesson)
  const xpAwarder = createFakeXpAwarder()
  const streakTracker = createFakeStreakTracker()
  const useCase = new CompleteMissionUseCase(
    missionRepository,
    lessonCompletionChecker,
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

    expect(result).toEqual({ status: 'completed' })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 30, reason: 'missao:m1' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('missões sem verificação cruzada aceitam o relato do cliente', async () => {
    const { xpAwarder, streakTracker, useCase } = build(false)

    const result = await useCase.execute({ userId: 'u1', missionId: 'm2' })

    expect(result).toEqual({ status: 'completed' })
    expect(xpAwarder.awarded).toEqual([{ userId: 'u1', amount: 20, reason: 'missao:m2' }])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
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
