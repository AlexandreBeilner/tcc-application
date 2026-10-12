import { generateReferralCode, nextMilestone, reachedMilestones } from '../../domain/referral'
import type { ReferralRepository } from '../ports/referralRepository'
import type { ReferralRewardRepository } from '../ports/referralRewardRepository'

export interface ReferralMilestoneView {
  threshold: number
  rewardDays: number
  reached: boolean
  // Concedido de fato (um marco alcançado pode estar pendente por falha do provedor).
  granted: boolean
}

export interface MyReferralView {
  code: string
  qualifiedCount: number
  // Contas que entraram pelo link mas ainda não concluíram a primeira lição.
  pendingCount: number
  next: { threshold: number; rewardDays: number; remaining: number }
  milestones: ReferralMilestoneView[]
}

// Quantos marcos da escada o painel mostra de uma vez: os da escada do banco mais os que a pessoa
// já alcançou na cauda.
export class GetMyReferralUseCase {
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly rewards: ReferralRewardRepository,
    private readonly randomInt: (maxExclusive: number) => number,
  ) {}

  async execute(userId: string): Promise<MyReferralView> {
    const code = await this.ensureCode(userId)
    const [qualifiedCount, pendingCount, ladder, rewards] = await Promise.all([
      this.referrals.countQualified(userId),
      this.referrals.countPending(userId),
      this.rewards.listMilestones(),
      this.rewards.listRewards(userId),
    ])
    const grantedAt = new Set(rewards.filter((r) => r.status === 'granted').map((r) => r.threshold))
    const reached = new Set(reachedMilestones(qualifiedCount, ladder).map((m) => m.threshold))
    const shown = new Map(ladder.map((m) => [m.threshold, m.rewardDays]))
    for (const m of reachedMilestones(qualifiedCount, ladder)) shown.set(m.threshold, m.rewardDays)
    const next = nextMilestone(qualifiedCount, ladder)
    shown.set(next.threshold, next.rewardDays)
    return {
      code,
      qualifiedCount,
      pendingCount,
      next: { ...next, remaining: next.threshold - qualifiedCount },
      milestones: [...shown.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([threshold, rewardDays]) => ({
          threshold,
          rewardDays,
          reached: reached.has(threshold),
          granted: grantedAt.has(threshold),
        })),
    }
  }

  private async ensureCode(userId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.referrals.findCodeByUser(userId)
      if (existing) return existing
      await this.referrals.insertCode(userId, generateReferralCode(this.randomInt))
    }
    const last = await this.referrals.findCodeByUser(userId)
    if (last) return last
    throw new Error('não foi possível gerar um código de indicação')
  }
}
