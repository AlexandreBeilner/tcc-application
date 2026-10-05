import type { AchievementRepository } from '../../../achievements/application/ports/achievementRepository'
import type {
  GrantAchievementUseCase,
  RevokeAchievementUseCase,
} from '../../../achievements/application/useCases/correctAchievements'
import {
  AchievementAlreadyUnlockedError,
  AchievementNotFoundError,
  AchievementNotUnlockedError,
} from '../../../achievements/domain/errors'
import type { AdjustProgressionUseCase } from '../../../gamification/application/useCases/adjustProgression'
import { InvalidProgressionAdjustmentError } from '../../../gamification/domain/errors'
import type { Progression } from '../../../gamification/domain/progression'
import type { LessonRepository } from '../../../lessons/application/ports/lessonRepository'
import type {
  MarkLessonCompletedUseCase,
  ReopenLessonUseCase,
} from '../../../lessons/application/useCases/correctLessonProgress'
import {
  LessonAlreadyCompletedError,
  LessonNotFoundError,
  LessonNotReopenableError,
} from '../../../lessons/domain/errors'
import {
  AdminCorrectionConflictError,
  AdminCorrectionNotFoundError,
  InvalidAdminCorrectionError,
} from '../../domain/errors'
import type { CorrectedProgression, UserCorrections } from '../../application/ports/userCorrections'

export interface InProcessUserCorrectionsDeps {
  adjustProgression: AdjustProgressionUseCase
  grantAchievement: GrantAchievementUseCase
  revokeAchievement: RevokeAchievementUseCase
  markLessonCompleted: MarkLessonCompletedUseCase
  reopenLesson: ReopenLessonUseCase
  achievementRepository: AchievementRepository
  lessonRepository: LessonRepository
}

function toCorrected(progression: Progression): CorrectedProgression {
  return {
    xp: progression.xp,
    level: progression.level,
    currentStreak: progression.currentStreak,
    longestStreak: progression.longestStreak,
  }
}

// Traduz as recusas dos módulos donos (gamificação, conquistas, lições) pros erros do
// painel, pra o router mapear 404/409/422 sem conhecer esses módulos.
function translate(err: unknown): never {
  if (err instanceof AchievementNotFoundError || err instanceof LessonNotFoundError) {
    throw new AdminCorrectionNotFoundError(err.message)
  }
  if (
    err instanceof AchievementAlreadyUnlockedError ||
    err instanceof AchievementNotUnlockedError ||
    err instanceof LessonAlreadyCompletedError ||
    err instanceof LessonNotReopenableError
  ) {
    throw new AdminCorrectionConflictError(err.message)
  }
  if (err instanceof InvalidProgressionAdjustmentError) {
    throw new InvalidAdminCorrectionError(err.message)
  }
  throw err
}

async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    return translate(err)
  }
}

export function createInProcessUserCorrections(
  deps: InProcessUserCorrectionsDeps,
): UserCorrections {
  return {
    async getContext(userId) {
      const [catalog, unlocked, lessons, progress] = await Promise.all([
        deps.achievementRepository.listCatalog(),
        deps.achievementRepository.listUnlockedForUser(userId),
        deps.lessonRepository.listAll(),
        deps.lessonRepository.listProgressForUser(userId),
      ])
      const unlockedIds = new Set(unlocked.map((u) => u.achievementId))
      const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]))
      return {
        achievements: catalog.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          unlocked: unlockedIds.has(a.id),
        })),
        lessons: lessons.map((lesson) => {
          const own = progressByLesson.get(lesson.id)
          return {
            id: lesson.id,
            code: lesson.code,
            title: lesson.title,
            trackNumber: lesson.trackNumber,
            status: own?.completedAt ? 'completed' : own ? 'in_progress' : 'not_started',
          }
        }),
      }
    },

    adjustXp: (userId, delta) =>
      guard(async () =>
        toCorrected(await deps.adjustProgression.execute({ userId, xpDelta: delta })),
      ),

    setStreak: (userId, value) =>
      guard(async () =>
        toCorrected(await deps.adjustProgression.execute({ userId, currentStreak: value })),
      ),

    grantAchievement: (userId, achievementId) =>
      guard(async () => {
        const achievement = await deps.grantAchievement.execute(userId, achievementId)
        return { id: achievement.id, name: achievement.name }
      }),

    revokeAchievement: (userId, achievementId) =>
      guard(async () => {
        const achievement = await deps.revokeAchievement.execute(userId, achievementId)
        return { id: achievement.id, name: achievement.name }
      }),

    completeLesson: (userId, lessonId) =>
      guard(async () => {
        await deps.markLessonCompleted.execute(userId, lessonId)
        return { id: lessonId, code: (await deps.lessonRepository.findById(lessonId))?.code ?? '' }
      }),

    reopenLesson: (userId, lessonId) =>
      guard(async () => {
        await deps.reopenLesson.execute(userId, lessonId)
        return { id: lessonId, code: (await deps.lessonRepository.findById(lessonId))?.code ?? '' }
      }),
  }
}
