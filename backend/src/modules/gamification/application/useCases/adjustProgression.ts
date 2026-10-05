import { InvalidProgressionAdjustmentError } from '../../domain/errors'
import { defaultProgression, levelForXp, type Progression } from '../../domain/progression'
import { todayUtc } from '../../domain/streak'
import type { AchievementChecker } from '../ports/achievementChecker'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface AdjustProgressionInput {
  userId: string
  // Variação de XP, positiva ou negativa. O total nunca fica abaixo de zero.
  xpDelta?: number
  // Define a sequência atual. `longestStreak` só sobe (é o máximo histórico).
  currentStreak?: number
}

// Correção manual de XP/nível e de streak feita pelo suporte (N.17). É o único
// caminho do painel até `user_progression`: nunca update direto, pra o nível
// continuar sempre derivado do XP (`levelForXp`) e as conquistas serem
// reavaliadas. Diferente de `AwardXpUseCase`, aceita valor negativo, porque
// corrigir é também tirar o que foi dado por engano.
export class AdjustProgressionUseCase {
  constructor(
    private readonly progressionRepository: ProgressionRepository,
    private readonly achievementChecker: AchievementChecker,
    private readonly today: () => string = () => todayUtc(new Date()),
  ) {}

  async execute(input: AdjustProgressionInput): Promise<Progression> {
    const { xpDelta, currentStreak } = input
    if (xpDelta === undefined && currentStreak === undefined) {
      throw new InvalidProgressionAdjustmentError('informe o ajuste de XP ou de streak')
    }
    if (xpDelta !== undefined && (!Number.isInteger(xpDelta) || xpDelta === 0)) {
      throw new InvalidProgressionAdjustmentError(
        'o ajuste de XP precisa ser um inteiro diferente de zero',
      )
    }
    if (currentStreak !== undefined && (!Number.isInteger(currentStreak) || currentStreak < 0)) {
      throw new InvalidProgressionAdjustmentError(
        'o streak precisa ser um inteiro maior ou igual a zero',
      )
    }

    const current =
      (await this.progressionRepository.findByUserId(input.userId)) ??
      defaultProgression(input.userId)
    let next: Progression = { ...current }

    if (xpDelta !== undefined) {
      const xp = current.xp + xpDelta
      if (xp < 0) {
        throw new InvalidProgressionAdjustmentError(
          `o usuário tem ${current.xp} XP, não dá pra tirar ${-xpDelta}`,
        )
      }
      next = { ...next, xp, level: levelForXp(xp) }
    }

    if (currentStreak !== undefined) {
      // Sequência definida na mão conta como "viva hoje": sem uma data de última
      // atividade recente, o próximo `touch()` a reiniciaria em 1. Zero limpa a data.
      next = {
        ...next,
        currentStreak,
        longestStreak: Math.max(current.longestStreak, currentStreak),
        lastQualifyingActivityDate: currentStreak > 0 ? this.today() : null,
      }
    }

    const saved = await this.progressionRepository.upsert(next)
    // XP ou streak maior pode satisfazer uma conquista; best-effort como em
    // `AwardXpUseCase` (o ajuste já foi gravado).
    try {
      await this.achievementChecker.checkAndUnlock(input.userId)
    } catch (err) {
      console.error(`checagem de conquistas falhou para userId=${input.userId}:`, err)
    }
    return saved
  }
}
