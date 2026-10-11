import type { Milestone } from '../../domain/referral'

export interface ReferralReward {
  threshold: number
  rewardDays: number
  status: 'pending' | 'granted'
  promoEndsAt: Date | null
  grantedAt: Date | null
}

export interface ReferralRewardRepository {
  listMilestones(): Promise<Milestone[]>
  // Cria só os que faltam (marco concedido uma única vez por pessoa).
  ensureRewards(referrerId: string, milestones: readonly Milestone[]): Promise<void>
  listRewards(referrerId: string): Promise<ReferralReward[]>
  setPromoEnd(referrerId: string, threshold: number, endsAt: Date): Promise<void>
  markGranted(referrerId: string, threshold: number, at: Date): Promise<void>
}

// Serializa o processamento das recompensas de um mesmo indicador (duas indicações que validam
// ao mesmo tempo não concedem o mesmo marco duas vezes).
export interface ReferrerLock {
  run<T>(referrerId: string, fn: () => Promise<T>): Promise<T>
}
