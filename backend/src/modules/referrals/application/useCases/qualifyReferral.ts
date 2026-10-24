import type { AchievementUnlocker } from '../ports/achievementUnlocker'
import type { ReferralRepository } from '../ports/referralRepository'

// A pessoa indicada concluiu a primeira lição (freio do ponto 052): a indicação passa a valer e
// o indicador pode alcançar as conquistas e os títulos de indicação. Chamado a cada lição
// concluída pela primeira vez; só a primeira vez de uma conta indicada faz efeito (`qualify` é
// condicional).
export class QualifyReferralUseCase {
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly achievements: AchievementUnlocker,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(referredId: string): Promise<void> {
    const referrerId = await this.referrals.qualify(referredId, this.now())
    if (!referrerId) return
    try {
      await this.achievements.check(referrerId)
    } catch (err) {
      console.error('[referrals] falha ao reavaliar as conquistas do indicador', err)
    }
  }
}
