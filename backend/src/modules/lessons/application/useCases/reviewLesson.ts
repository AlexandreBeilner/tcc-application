import { LessonNotCompletedError, LessonNotFoundError } from '../../domain/errors'
import type { AchievementChecker, UnlockedAchievement } from '../ports/achievementChecker'
import type { LessonRepository } from '../ports/lessonRepository'

export interface ReviewLessonInput {
  userId: string
  lessonId: string
}

export interface ReviewLessonResult {
  unlockedAchievements: UnlockedAchievement[]
}

// Revisão voluntária de lição já concluída (backlog engajamento H.2, tela
// 3.2 "modo revisão") — reabrir uma lição concluída já é permitido sem
// gate nenhum (`AdvanceLessonUseCase`/`GetLessonUseCase`); este caso de uso
// só registra `lastReviewedAt` pra sustentar a missão "revise uma lição
// antiga" com verificação cruzada de verdade, em vez de autorreporte do
// cliente. Nunca credita xp/streak — só a missão em si credita, quando o
// usuário confirma a conclusão dela.
//
// Chama `achievementChecker.checkAndUnlock` (H.1, critério `lesson_reviewed`)
// depois de gravar a revisão — nenhum outro ponto do fluxo dispara isso pra
// esta revisão específica, já que ela nunca passa por `xpAwarder`/
// `streakTracker` (os 2 pontos que carregam a checagem de conquista de
// carona pra qualquer outro critério). Sem esta chamada, "Voltou pra
// Revisar" só desbloquearia na próxima vez que o usuário completasse algo
// completamente sem relação, não no momento da própria revisão.
export class ReviewLessonUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly achievementChecker: AchievementChecker,
  ) {}

  async execute(input: ReviewLessonInput): Promise<ReviewLessonResult> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    const own = progress.find((p) => p.lessonId === input.lessonId)
    if (!own || own.completedAt === null) {
      throw new LessonNotCompletedError('lição ainda não concluída — não há o que revisar')
    }

    await this.lessonRepository.markReviewed(input.userId, input.lessonId, new Date())

    const unlockedAchievements = await this.achievementChecker.checkAndUnlock(input.userId)
    return { unlockedAchievements }
  }
}
