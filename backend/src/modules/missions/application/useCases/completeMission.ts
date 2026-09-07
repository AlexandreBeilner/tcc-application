import {
  LessonNotCompletedTodayError,
  MissionNotFoundError,
  OldLessonNotReviewedTodayError,
} from '../../domain/errors'
import { REVIEW_OLD_LESSON_MISSION_KEY, todayUtc } from '../../domain/mission'
import type { LessonCompletionChecker } from '../ports/lessonCompletionChecker'
import type { LessonReviewChecker } from '../ports/lessonReviewChecker'
import type { MissionRepository } from '../ports/missionRepository'
import type { StreakTracker } from '../ports/streakTracker'
import type { XpAwarder } from '../ports/xpAwarder'

export interface CompleteMissionInput {
  userId: string
  missionId: string
}

export interface CompleteMissionResult {
  status: 'completed'
}

export class CompleteMissionUseCase {
  constructor(
    private readonly missionRepository: MissionRepository,
    private readonly lessonCompletionChecker: LessonCompletionChecker,
    private readonly lessonReviewChecker: LessonReviewChecker,
    private readonly xpAwarder: XpAwarder,
    private readonly streakTracker: StreakTracker,
  ) {}

  async execute(input: CompleteMissionInput): Promise<CompleteMissionResult> {
    const mission = await this.missionRepository.findById(input.missionId)
    if (!mission) {
      throw new MissionNotFoundError('missão não encontrada')
    }

    const today = todayUtc(new Date())
    const existing = await this.missionRepository.findProgress(input.userId, input.missionId, today)
    if (existing?.status === 'completed') {
      // Idempotente — reenviar não credita xp/streak de novo.
      return { status: 'completed' }
    }

    // A missão "complete uma lição da trilha" é a única com essa coluna
    // dedicada — as demais aceitam o relato do cliente (calculadora/feed
    // não têm estado persistido hoje).
    if (mission.requiresLessonCompletion) {
      const hasCompletedLesson = await this.lessonCompletionChecker.hasCompletedLessonToday(
        input.userId,
      )
      if (!hasCompletedLesson) {
        throw new LessonNotCompletedTodayError('nenhuma lição concluída hoje')
      }
    }

    // Segunda verificação cruzada real (H.2), dispatchada por `key` — só
    // esta missão precisa dela, então não justifica coluna própria como
    // `requiresLessonCompletion` acima (ver comentário em `seedMissions.ts`).
    if (mission.key === REVIEW_OLD_LESSON_MISSION_KEY) {
      const hasReviewedOldLesson = await this.lessonReviewChecker.hasReviewedOldLessonToday(
        input.userId,
      )
      if (!hasReviewedOldLesson) {
        throw new OldLessonNotReviewedTodayError('nenhuma lição antiga revisada hoje')
      }
    }

    // `findProgress` acima é só um atalho pra reenvio sequencial (evita
    // checar lição/tocar streak de novo à toa) — a proteção real contra
    // duas requisições concorrentes (`POST /missions/:id/complete` chamado
    // em paralelo, deliberadamente ou não) creditarem xp em dobro é este
    // retorno: só quem de fato ganhou a transição atômica pending→completed
    // credita xp/streak.
    const claimed = await this.missionRepository.markCompleted(input.userId, input.missionId, today)
    if (!claimed) {
      return { status: 'completed' }
    }

    await this.xpAwarder.award(input.userId, mission.xpReward, `missao:${mission.id}`)
    await this.streakTracker.touch(input.userId)

    return { status: 'completed' }
  }
}
