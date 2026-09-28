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
import type { LessonCompletionChecker } from '../ports/lessonCompletionChecker'
import type { LessonReviewChecker } from '../ports/lessonReviewChecker'
import type { MicroDecisionStreakChecker } from '../ports/microDecisionStreakChecker'
import type { MissionRepository } from '../ports/missionRepository'
import type { StreakTracker } from '../ports/streakTracker'
import type { UnlockedAchievement, XpAwarder } from '../ports/xpAwarder'

export interface CompleteMissionInput {
  userId: string
  missionId: string
}

export interface CompleteMissionResult {
  status: 'completed'
  // Presentes só quando esta chamada é quem credita xp de fato — omitidos
  // nos retornos idempotentes (missão já concluída no dia, ou corrida
  // perdida pro `markCompleted` atômico) e nas duas exceções lançadas antes
  // do claim. Aditivos ao contrato já existente (tarefa I.2).
  xpAwarded?: number
  leveledUp?: boolean
  // Nível após este crédito (tarefa T.10) — mesma finalidade de
  // `AdvanceLessonResult.newLevel`.
  newLevel?: number
  streakMilestone?: number | null
  unlockedAchievements?: UnlockedAchievement[]
}

export class CompleteMissionUseCase {
  constructor(
    private readonly missionRepository: MissionRepository,
    private readonly lessonCompletionChecker: LessonCompletionChecker,
    private readonly lessonReviewChecker: LessonReviewChecker,
    private readonly microDecisionStreakChecker: MicroDecisionStreakChecker,
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

    // Terceira verificação cruzada real (H.3), mesmo tratamento por `key`.
    if (mission.key === MICRO_DECISION_STREAK_MISSION_KEY) {
      const hasStreak = await this.microDecisionStreakChecker.hasMicroDecisionStreakToday(
        input.userId,
      )
      if (!hasStreak) {
        throw new MicroDecisionStreakNotReachedError(
          'sequência de 3 acertos seguidos hoje ainda não alcançada',
        )
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

    // Sequencial de propósito, não `Promise.all` — mesmo motivo documentado
    // em `advanceLesson.ts`: `award`/`touch` chamam
    // `achievementChecker.checkAndUnlock` cada um por baixo, e rodando em
    // paralelo os dois podem ler o mesmo estado "ainda não desbloqueada" e
    // duplicar o resultado devolvido pro teatro de recompensa (I.1).
    const xpResult = await this.xpAwarder.award(
      input.userId,
      mission.xpReward,
      `missao:${mission.id}`,
    )
    const streakResult = await this.streakTracker.touch(input.userId)

    return {
      status: 'completed',
      xpAwarded: mission.xpReward,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.level,
      streakMilestone: streakResult.milestoneReached,
      unlockedAchievements: [
        ...xpResult.unlockedAchievements,
        ...streakResult.unlockedAchievements,
      ],
    }
  }
}
