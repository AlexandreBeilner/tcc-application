import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import {
  LESSON_UNLOCK_STEP,
  LESSON_XP_REWARD,
  completedTrackNumbers,
  isUnlocked,
} from '../../domain/lesson'
import type { LessonProgressRecord, LessonRepository } from '../ports/lessonRepository'
import type { SocialFeedRecorder } from '../ports/socialFeedRecorder'
import type { StreakTracker } from '../ports/streakTracker'
import type { UnlockedAchievement, XpAwarder } from '../ports/xpAwarder'

export interface AdvanceLessonInput {
  userId: string
  lessonId: string
  step: number
}

export interface AdvanceLessonResult {
  currentStep: number
  completed: boolean
  // Presentes só quando esta chamada é quem conclui a lição pela primeira
  // vez (`completingNow` abaixo) — aditivos ao contrato já existente
  // (tarefa I.2 do backlog de engajamento, pro "teatro de recompensa" da
  // I.1 disparar em tempo real, sem precisar de um segundo round-trip).
  xpAwarded?: number
  leveledUp?: boolean
  streakMilestone?: number | null
  unlockedAchievements?: UnlockedAchievement[]
}

export class AdvanceLessonUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly xpAwarder: XpAwarder,
    private readonly streakTracker: StreakTracker,
    private readonly socialFeedRecorder: SocialFeedRecorder,
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
      const xpResult = await this.xpAwarder.award(
        input.userId,
        LESSON_XP_REWARD,
        `licao:${lesson.code}`,
      )
      const streakResult = await this.streakTracker.touch(input.userId)
      await this.recordTrackCompletionIfJustFinished(
        input.userId,
        lesson.id,
        lesson.trackNumber,
        progress,
        saved.completedAt,
      )

      return {
        currentStep: saved.currentStep,
        completed: saved.completedAt !== null,
        xpAwarded: LESSON_XP_REWARD,
        leveledUp: xpResult.leveledUp,
        streakMilestone: streakResult.milestoneReached,
        unlockedAchievements: [
          ...xpResult.unlockedAchievements,
          ...streakResult.unlockedAchievements,
        ],
      }
    }

    return { currentStep: saved.currentStep, completed: saved.completedAt !== null }
  }

  // Detecta "esta conclusão terminou a trilha" comparando o conjunto de
  // trilhas completas antes/depois desta escrita, em vez de checar "é a
  // última lição por sortOrder" (evitaria carregar `listAll()` sempre, mas
  // duplicaria a regra de "trilha completa" já em `completedTrackNumbers`,
  // reaproveitada por `GetCompletedTracksUseCase`/F.2).
  private async recordTrackCompletionIfJustFinished(
    userId: string,
    lessonId: string,
    trackNumber: number,
    progressBeforeWrite: LessonProgressRecord[],
    newCompletedAt: Date | null,
  ): Promise<void> {
    const allLessons = await this.lessonRepository.listAll()
    const completedAtByLessonId = new Map(
      progressBeforeWrite.map((p) => [p.lessonId, p.completedAt]),
    )
    const toTrackProgress = () =>
      allLessons.map((l) => ({
        trackNumber: l.trackNumber,
        completedAt: completedAtByLessonId.get(l.id) ?? null,
      }))

    const tracksBefore = new Set(completedTrackNumbers(toTrackProgress()))
    completedAtByLessonId.set(lessonId, newCompletedAt)
    const tracksAfter = completedTrackNumbers(toTrackProgress())

    if (tracksAfter.includes(trackNumber) && !tracksBefore.has(trackNumber)) {
      await this.socialFeedRecorder.recordTrackCompleted(userId, trackNumber)
    }
  }
}
