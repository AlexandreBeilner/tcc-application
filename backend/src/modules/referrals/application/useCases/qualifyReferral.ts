import { reachedMilestones, promoEndFor } from '../../domain/referral'
import type { AchievementUnlocker } from '../ports/achievementUnlocker'
import type { PromotionalPro } from '../ports/promotionalPro'
import type { ReferralRepository } from '../ports/referralRepository'
import type { ReferralRewardRepository, ReferrerLock } from '../ports/referralRewardRepository'

// A pessoa indicada concluiu a primeira lição (freio do ponto 052): a indicação passa a valer e
// o indicador pode alcançar marcos. Chamado a cada lição concluída pela primeira vez; só a
// primeira vez de uma conta indicada faz efeito (`qualify` é condicional).
export class QualifyReferralUseCase {
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly rewards: ReferralRewardRepository,
    private readonly lock: ReferrerLock,
    private readonly pro: PromotionalPro,
    private readonly achievements: AchievementUnlocker,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(referredId: string): Promise<void> {
    const referrerId = await this.referrals.qualify(referredId, this.now())
    if (!referrerId) return
    await this.settleRewards(referrerId)
    try {
      await this.achievements.check(referrerId)
    } catch (err) {
      console.error('[referrals] falha ao reavaliar as conquistas do indicador', err)
    }
  }

  // Cria os marcos alcançados e concede o que está pendente. Idempotente: pode rodar de novo (por
  // outra indicação ou numa reexecução) sem conceder duas vezes. Falha do provedor deixa o marco
  // pendente pra próxima tentativa, nunca perde a indicação.
  async settleRewards(referrerId: string): Promise<void> {
    await this.lock.run(referrerId, async () => {
      const [count, ladder] = await Promise.all([
        this.referrals.countQualified(referrerId),
        this.rewards.listMilestones(),
      ])
      await this.rewards.ensureRewards(referrerId, reachedMilestones(count, ladder))
      const pending = (await this.rewards.listRewards(referrerId)).filter(
        (r) => r.status === 'pending',
      )
      for (const reward of pending) {
        try {
          const now = this.now()
          // O fim é gravado antes da chamada: repetir com o mesmo fim é duplicata pro provedor.
          let endsAt = reward.promoEndsAt
          if (!endsAt || endsAt <= now) {
            endsAt = promoEndFor(
              now,
              await this.pro.currentAccessEnd(referrerId),
              reward.rewardDays,
            )
            await this.rewards.setPromoEnd(referrerId, reward.threshold, endsAt)
          }
          await this.pro.grantUntil(referrerId, endsAt)
          await this.rewards.markGranted(referrerId, reward.threshold, this.now())
        } catch (err) {
          console.error(
            `[referrals] concessão do marco ${reward.threshold} pendente (nova tentativa na próxima indicação)`,
            err,
          )
        }
      }
    })
  }
}
