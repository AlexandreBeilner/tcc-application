import { describe, expect, it } from 'vitest'
import {
  GrantAchievementUseCase,
  RevokeAchievementUseCase,
} from '../../../achievements/application/useCases/correctAchievements'
import type { Achievement } from '../../../achievements/domain/achievement'
import { createFakeAchievementRepository } from '../../../achievements/test/fakes/fakeAchievementRepository'
import { AdjustProgressionUseCase } from '../../../gamification/application/useCases/adjustProgression'
import { createFakeAchievementChecker } from '../../../gamification/test/fakes/fakeAchievementChecker'
import { createFakeProgressionRepository } from '../../../gamification/test/fakes/fakeProgressionRepository'
import {
  MarkLessonCompletedUseCase,
  ReopenLessonUseCase,
} from '../../../lessons/application/useCases/correctLessonProgress'
import { createFakeLessonRepository } from '../../../lessons/test/fakes/fakeLessonRepository'
import {
  AdminCorrectionConflictError,
  AdminCorrectionNotFoundError,
  InvalidAdminCorrectionError,
} from '../../domain/errors'
import { createInProcessUserCorrections } from './inProcessUserCorrections'

const achievement: Achievement = {
  id: 'a1',
  name: 'Primeira Semana',
  description: 'Sete dias seguidos',
  criteriaType: 'streak_days',
  criteriaValue: 7,
  isActive: true,
}

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

function build() {
  const progressionRepository = createFakeProgressionRepository()
  const achievementRepository = createFakeAchievementRepository([achievement])
  const lessonRepository = createFakeLessonRepository([lesson])
  const corrections = createInProcessUserCorrections({
    adjustProgression: new AdjustProgressionUseCase(
      progressionRepository,
      createFakeAchievementChecker(),
      () => '2026-10-03',
    ),
    grantAchievement: new GrantAchievementUseCase(achievementRepository),
    revokeAchievement: new RevokeAchievementUseCase(achievementRepository),
    markLessonCompleted: new MarkLessonCompletedUseCase(lessonRepository),
    reopenLesson: new ReopenLessonUseCase(lessonRepository),
    achievementRepository,
    lessonRepository,
  })
  return { corrections, progressionRepository }
}

describe('inProcessUserCorrections', () => {
  it('ajusta XP e streak pelo caso de uso de gamificação e devolve a progressão', async () => {
    const { corrections, progressionRepository } = build()

    const afterXp = await corrections.adjustXp('u1', 300)
    const afterStreak = await corrections.setStreak('u1', 9)

    expect(afterXp).toEqual({ xp: 300, level: 3, currentStreak: 0, longestStreak: 0 })
    expect(afterStreak).toMatchObject({ xp: 300, currentStreak: 9, longestStreak: 9 })
    expect((await progressionRepository.findByUserId('u1'))?.xp).toBe(300)
  })

  it('traduz a recusa da gamificação pra InvalidAdminCorrectionError', async () => {
    const { corrections } = build()

    await expect(corrections.adjustXp('u1', -10)).rejects.toBeInstanceOf(
      InvalidAdminCorrectionError,
    )
  })

  it('concede e revoga conquista, e traduz inexistente e conflito', async () => {
    const { corrections } = build()

    expect(await corrections.grantAchievement('u1', 'a1')).toEqual({
      id: 'a1',
      name: 'Primeira Semana',
    })
    await expect(corrections.grantAchievement('u1', 'a1')).rejects.toBeInstanceOf(
      AdminCorrectionConflictError,
    )
    await corrections.revokeAchievement('u1', 'a1')
    await expect(corrections.revokeAchievement('u1', 'a1')).rejects.toBeInstanceOf(
      AdminCorrectionConflictError,
    )
    await expect(corrections.grantAchievement('u1', 'nope')).rejects.toBeInstanceOf(
      AdminCorrectionNotFoundError,
    )
  })

  it('conclui e reabre lição, e traduz inexistente e conflito', async () => {
    const { corrections } = build()

    expect(await corrections.completeLesson('u1', 'l1')).toEqual({ id: 'l1', code: '0.1' })
    await expect(corrections.completeLesson('u1', 'l1')).rejects.toBeInstanceOf(
      AdminCorrectionConflictError,
    )
    await corrections.reopenLesson('u1', 'l1')
    await expect(corrections.reopenLesson('u1', 'l1')).rejects.toBeInstanceOf(
      AdminCorrectionConflictError,
    )
    await expect(corrections.completeLesson('u1', 'nope')).rejects.toBeInstanceOf(
      AdminCorrectionNotFoundError,
    )
  })

  it('o contexto marca conquistas obtidas e o status de cada lição do usuário', async () => {
    const { corrections } = build()
    await corrections.grantAchievement('u1', 'a1')
    await corrections.completeLesson('u1', 'l1')

    const mine = await corrections.getContext('u1')
    const other = await corrections.getContext('u2')

    expect(mine.achievements).toEqual([
      { id: 'a1', name: 'Primeira Semana', description: 'Sete dias seguidos', unlocked: true },
    ])
    expect(mine.lessons[0]).toMatchObject({ id: 'l1', code: '0.1', status: 'completed' })
    expect(other.achievements[0].unlocked).toBe(false)
    expect(other.lessons[0].status).toBe('not_started')
  })
})
