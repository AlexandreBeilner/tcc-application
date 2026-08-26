import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import { LESSON_UNLOCK_STEP, LESSON_XP_REWARD, isUnlocked } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'
import type { StreakTracker } from '../ports/streakTracker'
import type { XpAwarder } from '../ports/xpAwarder'

export interface AdvanceLessonInput {
  userId: string
  lessonId: string
  step: number
}

export interface AdvanceLessonResult {
  currentStep: number
  completed: boolean
}

export class AdvanceLessonUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly xpAwarder: XpAwarder,
    private readonly streakTracker: StreakTracker,
  ) {}

  async execute(input: AdvanceLessonInput): Promise<AdvanceLessonResult> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    const completedCount = progress.filter((p) => p.completedAt !== null).length
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const alreadyCompleted = own?.completedAt != null

    // Reabrir uma lição já concluída (modo revisão, tela 3.2) sempre é
    // permitido, mesmo que a contagem global de concluídas hoje não a
    // sustentaria mais desbloqueada — só lição nunca antes concluída passa
    // pelo gate de desbloqueio.
    if (!alreadyCompleted && !isUnlocked(lesson.sortOrder, completedCount)) {
      throw new LessonLockedError('lição bloqueada')
    }

    // Idempotente: `completedAt` só é setado na primeira vez que o step de
    // desbloqueio é alcançado — reenviar o mesmo step depois não credita
    // xp/streak de novo (tela 3.2 "modo revisão").
    const completingNow = !alreadyCompleted && input.step >= LESSON_UNLOCK_STEP
    const completedAt = alreadyCompleted
      ? (own?.completedAt ?? null)
      : completingNow
        ? new Date()
        : null

    const saved = await this.lessonRepository.upsertProgress(input.userId, input.lessonId, {
      currentStep: input.step,
      completedAt,
    })

    if (completingNow) {
      await this.xpAwarder.award(input.userId, LESSON_XP_REWARD, `licao:${lesson.code}`)
      await this.streakTracker.touch(input.userId)
    }

    return { currentStep: saved.currentStep, completed: saved.completedAt !== null }
  }
}
