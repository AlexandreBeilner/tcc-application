import type { DailyResult } from '../domain/content'
import { correctCardCount, finalizeResult } from '../domain/resultState'
import type { LoadedGame } from './dailyGameLoader'
import type { DailyResultRepository } from './ports/dailyResultRepository'
import type { StreakTracker } from './ports/streakTracker'
import type { UnlockedAchievement, XpAwarder } from './ports/xpAwarder'

// Só presente na resposta da chamada que fecha o jogo.
export interface DailyCompletion {
  correctCards: number
  // 0 em dia anterior (sem XP, seção 3.6) ou depois da virada.
  xpAwarded: number
  // Os campos abaixo só vêm quando houve crédito de XP e streak (jogo do dia, antes da virada);
  // alimentam o teatro de recompensa (nível, marco de streak, conquistas).
  level?: number
  leveledUp?: boolean
  streakMilestone?: number | null
  unlockedAchievements?: UnlockedAchievement[]
}

// Grava a jogada de um usuário logado e, na chamada que fecha o jogo do dia, concede XP e streak.
// A gravação e o fechamento são uma operação só no repositório (linha travada), então com duas
// abas só uma chamada vê `justCompleted` e só ela credita (idempotente). O crédito vem depois do
// commit, sequencial como em `missions`: os dois checam conquistas por baixo e em paralelo
// poderiam devolver a mesma conquista duas vezes.
export class DailyProgressRecorder {
  constructor(
    private readonly results: DailyResultRepository,
    private readonly xpAwarder: XpAwarder,
    private readonly streakTracker: StreakTracker,
  ) {}

  async record<T>(
    userId: string,
    game: LoadedGame,
    now: Date,
    apply: (current: DailyResult) => { next: DailyResult; value: T },
  ): Promise<{ value: T; result: DailyResult; completion?: DailyCompletion }> {
    const { result, value } = await this.results.update(userId, game.number, now, (current) => {
      const applied = apply(current)
      const finalized = finalizeResult(applied.next, game.awardsXp, now)
      return {
        next: finalized.next,
        value: { value: applied.value, justCompleted: finalized.justCompleted },
      }
    })
    if (!value.justCompleted) return { value: value.value, result }

    const completion: DailyCompletion = {
      correctCards: correctCardCount(result),
      xpAwarded: result.xpAwarded,
    }
    if (game.awardsXp) {
      const xp = await this.xpAwarder.award(userId, result.xpAwarded, `diario:${game.number}`)
      const streak = await this.streakTracker.touch(userId)
      completion.level = xp.level
      completion.leveledUp = xp.leveledUp
      completion.streakMilestone = streak.milestoneReached
      completion.unlockedAchievements = [...xp.unlockedAchievements, ...streak.unlockedAchievements]
    }
    return { value: value.value, result, completion }
  }
}
