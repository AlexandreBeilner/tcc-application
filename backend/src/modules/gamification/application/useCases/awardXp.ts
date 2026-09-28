import { InvalidXpAmountError } from '../../domain/errors'
import { defaultProgression, levelForXp } from '../../domain/progression'
import type { AchievementChecker, UnlockedAchievement } from '../ports/achievementChecker'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface AwardXpInput {
  userId: string
  amount: number
  reason: string
}

export interface AwardXpResult {
  xp: number
  level: number
  leveledUp: boolean
  unlockedAchievements: UnlockedAchievement[]
}

// Dono único de XP/nível do sistema — nenhum outro módulo escreve
// `user_progression` direto. Módulos consumidores (missões, lições) vão
// depender de uma port própria e mínima (`xpAwarder`, um método `award`)
// implementada, na composição (app.ts), por um adapter fino que chama
// `execute` aqui em processo (mesmo runtime Node, sem HTTP) — ver
// .claude/backlog-plataforma-investimentos.md, tarefa 5.1.
export class AwardXpUseCase {
  constructor(
    private readonly progressionRepository: ProgressionRepository,
    private readonly achievementChecker: AchievementChecker,
  ) {}

  async execute(input: AwardXpInput): Promise<AwardXpResult> {
    if (input.amount <= 0) {
      throw new InvalidXpAmountError('quantidade de xp deve ser positiva')
    }

    const current =
      (await this.progressionRepository.findByUserId(input.userId)) ??
      defaultProgression(input.userId)

    // Nível sempre recalculado a partir do xp acumulado, nunca incrementado
    // à parte — evita dessincronização e sustenta saltos de 2+ níveis num
    // único crédito grande. Campos de streak preservados como estão — este
    // caso de uso não é dono deles (ver TouchStreakUseCase, 5.3).
    const xp = current.xp + input.amount
    const level = levelForXp(xp)
    await this.progressionRepository.upsert({ ...current, xp, level })
    // Qualquer crédito de xp pode satisfazer um critério de conquista
    // (5.2) — checado em processo depois de persistir, nunca por polling.
    // Resultado capturado (I.2) — antes descartado, sem dado nenhum pro
    // "teatro de recompensa" (I.1) disparar.
    // Best-effort: xp/nível já foram persistidos acima, então uma falha
    // aqui (ex: engine indisponível durante o replay de net worth) não pode
    // virar 500 pra uma escrita que já teve sucesso — só logada.
    let unlockedAchievements: UnlockedAchievement[] = []
    try {
      unlockedAchievements = await this.achievementChecker.checkAndUnlock(input.userId)
    } catch (err) {
      console.error(`checagem de conquistas falhou para userId=${input.userId}:`, err)
    }

    return { xp, level, leveledUp: level > current.level, unlockedAchievements }
  }
}
