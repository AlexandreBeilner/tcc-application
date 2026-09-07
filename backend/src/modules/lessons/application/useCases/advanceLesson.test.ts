import { describe, expect, it } from 'vitest'
import {
  InvalidMicroDecisionOptionError,
  LessonLockedError,
  LessonNotFoundError,
} from '../../domain/errors'
import { LESSON_UNLOCK_STEP, LESSON_XP_REWARD } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { createFakeSocialFeedRecorder } from '../../test/fakes/fakeSocialFeedRecorder'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { AdvanceLessonUseCase } from './advanceLesson'

// l1/l2 fecham a Trilha 0; l3 é a primeira lição da Trilha 1 — permite
// testar "concluiu a última lição da trilha" (l2) vs. "concluiu lição que
// não fecha nenhuma trilha" (l3, trilha 1 sozinha ainda incompleta).
const lessons = [1, 2, 3].map((n) => ({
  id: `l${n}`,
  code: n <= 2 ? `0.${n}` : `1.${n}`,
  title: `Lição ${n}`,
  trackNumber: n <= 2 ? 0 : 1,
  trackName: n <= 2 ? 'Trilha 0: Fundamentos' : 'Trilha 1: Renda Fixa',
  sortOrder: n,
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
}))

function build() {
  const lessonRepository = createFakeLessonRepository(lessons)
  const xpAwarder = createFakeXpAwarder()
  const streakTracker = createFakeStreakTracker()
  const socialFeedRecorder = createFakeSocialFeedRecorder()
  const useCase = new AdvanceLessonUseCase(
    lessonRepository,
    xpAwarder,
    streakTracker,
    socialFeedRecorder,
  )
  return { lessonRepository, xpAwarder, streakTracker, socialFeedRecorder, useCase }
}

describe('AdvanceLessonUseCase', () => {
  it('grava currentStep sem concluir antes do step de desbloqueio', async () => {
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: 1 })

    expect(result).toEqual({ currentStep: 1, completed: false })
  })

  it('conclui, credita xp e toca o streak ao chegar no step de desbloqueio, na primeira vez', async () => {
    const { xpAwarder, streakTracker, socialFeedRecorder, useCase } = build()

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    expect(result).toEqual({
      currentStep: LESSON_UNLOCK_STEP,
      completed: true,
      xpAwarded: LESSON_XP_REWARD,
      leveledUp: false,
      streakMilestone: null,
      unlockedAchievements: [],
    })
    expect(xpAwarder.awarded).toEqual([
      { userId: 'u1', amount: LESSON_XP_REWARD, reason: 'licao:0.1' },
    ])
    expect(streakTracker.touchedUserIds).toEqual(['u1'])
    // l1 não é a última lição da Trilha 0 (l2 ainda falta) — nenhum evento
    // de trilha concluída ainda.
    expect(socialFeedRecorder.recorded).toEqual([])
  })

  it('propaga leveledUp, streakMilestone e a união das conquistas devolvidas por xpAwarder/streakTracker', async () => {
    const { lessonRepository, socialFeedRecorder } = build()
    const xpAwarder = createFakeXpAwarder({
      xp: 150,
      level: 2,
      leveledUp: true,
      unlockedAchievements: [{ id: 'a1', name: 'Primeiros Passos', description: null }],
    })
    const streakTracker = createFakeStreakTracker({
      currentStreak: 7,
      longestStreak: 7,
      milestoneReached: 7,
      unlockedAchievements: [{ id: 'a2', name: 'Primeira Semana', description: null }],
    })
    const useCaseWithRewards = new AdvanceLessonUseCase(
      lessonRepository,
      xpAwarder,
      streakTracker,
      socialFeedRecorder,
    )

    const result = await useCaseWithRewards.execute({
      userId: 'u1',
      lessonId: 'l1',
      step: LESSON_UNLOCK_STEP,
    })

    expect(result).toEqual({
      currentStep: LESSON_UNLOCK_STEP,
      completed: true,
      xpAwarded: LESSON_XP_REWARD,
      leveledUp: true,
      streakMilestone: 7,
      unlockedAchievements: [
        { id: 'a1', name: 'Primeiros Passos', description: null },
        { id: 'a2', name: 'Primeira Semana', description: null },
      ],
    })
  })

  it('grava evento de trilha concluída ao terminar a última lição da trilha', async () => {
    const { socialFeedRecorder, useCase } = build()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    await useCase.execute({ userId: 'u1', lessonId: 'l2', step: LESSON_UNLOCK_STEP })

    expect(socialFeedRecorder.recorded).toEqual([{ userId: 'u1', trackNumber: 0 }])
  })

  it('reenviar o step de desbloqueio da última lição de novo não grava o evento de trilha duas vezes', async () => {
    const { socialFeedRecorder, useCase } = build()
    await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })
    await useCase.execute({ userId: 'u1', lessonId: 'l2', step: LESSON_UNLOCK_STEP })

    await useCase.execute({ userId: 'u1', lessonId: 'l2', step: LESSON_UNLOCK_STEP })

    expect(socialFeedRecorder.recorded).toHaveLength(1)
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

  it('não credita xp/streak/trilha quando perde a corrida de conclusão pra outra requisição concorrente', async () => {
    const { lessonRepository, xpAwarder, streakTracker, socialFeedRecorder, useCase } = build()
    // Simula duas requisições concorrentes completando a mesma lição: o
    // repositório (via `setWhere` real no Postgres) só deixa uma vencer —
    // aqui forçamos o resultado "perdeu a corrida" que o repositório real
    // devolveria pra segunda requisição.
    const completedAt = new Date('2026-01-01T00:00:00Z')
    lessonRepository.completeIfNotAlreadyCompleted = async (_userId, _lessonId, currentStep) => ({
      record: {
        lessonId: 'l1',
        currentStep,
        completedAt,
        lastReviewedAt: null,
        microDecisionSelectedOption: null,
      },
      wonRace: false,
    })

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1', step: LESSON_UNLOCK_STEP })

    expect(result).toEqual({ currentStep: LESSON_UNLOCK_STEP, completed: true })
    expect(xpAwarder.awarded).toEqual([])
    expect(streakTracker.touchedUserIds).toEqual([])
    expect(socialFeedRecorder.recorded).toEqual([])
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

// Aposta com acerto/erro real (backlog engajamento B.2) — lição própria, com
// `microDecisionOptions` preenchido, separada das de cima (todas com
// `null`) pra não interferir na progressão sortOrder-a-sortOrder já testada.
const lessonWithOptions = {
  id: 'lo1',
  code: '1.1',
  title: 'Lição com opções',
  trackNumber: 1,
  trackName: 'Trilha 1: Renda Fixa',
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
  microDecisionOptions: ['Sim', 'Não'],
  microDecisionCorrectOption: 0,
}

function buildWithOptions() {
  const lessonRepository = createFakeLessonRepository([lessonWithOptions])
  const useCase = new AdvanceLessonUseCase(
    lessonRepository,
    createFakeXpAwarder(),
    createFakeStreakTracker(),
    createFakeSocialFeedRecorder(),
  )
  return { lessonRepository, useCase }
}

describe('AdvanceLessonUseCase — aposta com acerto/erro real (B.2)', () => {
  it('persiste selectedOption válido, lido de volta em listProgressForUser', async () => {
    const { lessonRepository, useCase } = buildWithOptions()

    await useCase.execute({ userId: 'u1', lessonId: 'lo1', step: 2, selectedOption: 1 })

    const [progress] = await lessonRepository.listProgressForUser('u1')
    expect(progress.microDecisionSelectedOption).toBe(1)
  })

  it('rejeita selectedOption fora do intervalo de microDecisionOptions', async () => {
    const { useCase } = buildWithOptions()

    await expect(
      useCase.execute({ userId: 'u1', lessonId: 'lo1', step: 2, selectedOption: 2 }),
    ).rejects.toBeInstanceOf(InvalidMicroDecisionOptionError)
  })

  it('devolve microDecisionCorrect/correctOptionLabel na resposta quando selectedOption é enviado (correção da revisão da PR 18)', async () => {
    const { useCase } = buildWithOptions()

    const acerto = await useCase.execute({
      userId: 'u1',
      lessonId: 'lo1',
      step: 2,
      selectedOption: 0,
    })
    expect(acerto).toMatchObject({ microDecisionCorrect: true, correctOptionLabel: 'Sim' })

    const erro = await useCase.execute({
      userId: 'u2',
      lessonId: 'lo1',
      step: 2,
      selectedOption: 1,
    })
    expect(erro).toMatchObject({ microDecisionCorrect: false, correctOptionLabel: 'Sim' })
  })

  it('não devolve microDecisionCorrect/correctOptionLabel quando selectedOption não é enviado', async () => {
    const { useCase } = buildWithOptions()

    const result = await useCase.execute({ userId: 'u1', lessonId: 'lo1', step: 2 })

    expect(result).not.toHaveProperty('microDecisionCorrect')
    expect(result).not.toHaveProperty('correctOptionLabel')
  })

  it('persiste selectedOption mesmo quando a mesma chamada já conclui a lição', async () => {
    const { lessonRepository, useCase } = buildWithOptions()

    await useCase.execute({
      userId: 'u1',
      lessonId: 'lo1',
      step: LESSON_UNLOCK_STEP,
      selectedOption: 1,
    })

    const [progress] = await lessonRepository.listProgressForUser('u1')
    expect(progress.completedAt).not.toBeNull()
    expect(progress.microDecisionSelectedOption).toBe(1)
  })

  it('ignora selectedOption sem erro pra lição sem opções reais (mantém checkbox)', async () => {
    const { useCase } = build()

    const result = await useCase.execute({
      userId: 'u1',
      lessonId: 'l1',
      step: 1,
      selectedOption: 5,
    })

    expect(result).toEqual({ currentStep: 1, completed: false })
  })
})
