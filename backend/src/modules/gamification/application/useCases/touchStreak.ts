import { defaultProgression } from '../../domain/progression'
import { streakMilestoneReached, todayUtc, touch } from '../../domain/streak'
import type { AchievementChecker, UnlockedAchievement } from '../ports/achievementChecker'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface TouchStreakInput {
  userId: string
}

export interface TouchStreakResult {
  currentStreak: number
  longestStreak: number
  // Marco de streak (7 ou 30 dias, `domain/streak.streakMilestoneReached`)
  // cruzado exatamente por este `touch()` — `null` em qualquer outro dia,
  // inclusive numa chamada idempotente repetida no mesmo dia.
  milestoneReached: number | null
  unlockedAchievements: UnlockedAchievement[]
}

// Chamado em processo (mesmo padrão de AwardXpUseCase, 5.1) a partir de
// qualquer atividade-chave do dia: conclusão de lição (5.6) e conclusão de
// missão diária (5.4) — únicas atividades observáveis pelo backend nesta
// semana. Módulos consumidores vão depender de uma port própria e mínima
// (`streakTracker`) implementada, na composição (app.ts), por um adapter
// fino que chama `execute` aqui — mesma decisão de composição de `xpAwarder`
// (ver awardXp.ts).
export class TouchStreakUseCase {
  constructor(
    private readonly progressionRepository: ProgressionRepository,
    private readonly achievementChecker: AchievementChecker,
  ) {}

  async execute(input: TouchStreakInput): Promise<TouchStreakResult> {
    const current =
      (await this.progressionRepository.findByUserId(input.userId)) ??
      defaultProgression(input.userId)

    const today = todayUtc(new Date())
    const next = touch(
      {
        currentStreak: current.currentStreak,
        longestStreak: current.longestStreak,
        lastQualifyingActivityDate: current.lastQualifyingActivityDate,
      },
      today,
    )

    // Campos de xp/nível preservados como estão — este caso de uso não é
    // dono deles (ver AwardXpUseCase, 5.1).
    await this.progressionRepository.upsert({ ...current, ...next })
    // Qualquer toque de streak pode satisfazer um critério de conquista
    // (5.2) — mesmo raciocínio de AwardXpUseCase. Resultado capturado (I.2).
    const unlockedAchievements = await this.achievementChecker.checkAndUnlock(input.userId)
    const milestoneReached = streakMilestoneReached(current.currentStreak, next.currentStreak)

    return {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      milestoneReached,
      unlockedAchievements,
    }
  }
}
