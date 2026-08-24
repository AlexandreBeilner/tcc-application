import { defaultProgression } from '../../domain/progression'
import { todayUtc, touch } from '../../domain/streak'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface TouchStreakInput {
  userId: string
}

export interface TouchStreakResult {
  currentStreak: number
  longestStreak: number
}

// Chamado em processo (mesmo padrão de AwardXpUseCase, 5.1) a partir de
// qualquer atividade-chave do dia: conclusão de lição (5.6) e conclusão de
// missão diária (5.4) — únicas atividades observáveis pelo backend nesta
// semana. Módulos consumidores vão depender de uma port própria e mínima
// (`streakTracker`) implementada, na composição (app.ts), por um adapter
// fino que chama `execute` aqui — mesma decisão de composição de `xpAwarder`
// (ver awardXp.ts).
export class TouchStreakUseCase {
  constructor(private readonly progressionRepository: ProgressionRepository) {}

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

    return { currentStreak: next.currentStreak, longestStreak: next.longestStreak }
  }
}
