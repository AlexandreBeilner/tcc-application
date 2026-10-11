import type { Milestone } from '../../domain/referral'
import type { ReferralRepository } from '../../application/ports/referralRepository'
import type {
  ReferralReward,
  ReferralRewardRepository,
  ReferrerLock,
} from '../../application/ports/referralRewardRepository'
import type { PromotionalPro } from '../../application/ports/promotionalPro'

export interface FakeReferralRepository extends ReferralRepository {
  codes: Map<string, string>
  referrals: Map<string, { referrerId: string; status: 'pending' | 'qualified' }>
}

export function createFakeReferralRepository(): FakeReferralRepository {
  const codes = new Map<string, string>()
  const referrals = new Map<string, { referrerId: string; status: 'pending' | 'qualified' }>()
  const countBy = (referrerId: string, status: string) =>
    [...referrals.values()].filter((r) => r.referrerId === referrerId && r.status === status).length
  return {
    codes,
    referrals,
    async findCodeByUser(userId) {
      return codes.get(userId) ?? null
    },
    async findUserByCode(code) {
      return [...codes.entries()].find(([, c]) => c === code)?.[0] ?? null
    },
    async insertCode(userId, code) {
      if (codes.has(userId) || [...codes.values()].includes(code)) return false
      codes.set(userId, code)
      return true
    },
    async createReferral(referrerId, referredId) {
      if (referrals.has(referredId) || referrerId === referredId) return false
      referrals.set(referredId, { referrerId, status: 'pending' })
      return true
    },
    async qualify(referredId) {
      const row = referrals.get(referredId)
      if (!row || row.status !== 'pending') return null
      row.status = 'qualified'
      return row.referrerId
    },
    async countQualified(referrerId) {
      return countBy(referrerId, 'qualified')
    },
    async countPending(referrerId) {
      return countBy(referrerId, 'pending')
    },
  }
}

export interface FakeRewardRepository extends ReferralRewardRepository {
  rows: Map<string, ReferralReward>
}

export function createFakeRewardRepository(ladder: Milestone[]): FakeRewardRepository {
  const rows = new Map<string, ReferralReward>()
  const key = (u: string, t: number) => `${u}:${t}`
  return {
    rows,
    async listMilestones() {
      return ladder
    },
    async ensureRewards(referrerId, milestones) {
      for (const m of milestones) {
        if (!rows.has(key(referrerId, m.threshold))) {
          rows.set(key(referrerId, m.threshold), {
            threshold: m.threshold,
            rewardDays: m.rewardDays,
            status: 'pending',
            promoEndsAt: null,
            grantedAt: null,
          })
        }
      }
    },
    async listRewards(referrerId) {
      return [...rows.entries()]
        .filter(([k]) => k.startsWith(`${referrerId}:`))
        .map(([, v]) => ({ ...v }))
    },
    async setPromoEnd(referrerId, threshold, endsAt) {
      const row = rows.get(key(referrerId, threshold))
      if (row) row.promoEndsAt = endsAt
    },
    async markGranted(referrerId, threshold, at) {
      const row = rows.get(key(referrerId, threshold))
      if (row) {
        row.status = 'granted'
        row.grantedAt = at
      }
    },
  }
}

export const passThroughLock: ReferrerLock = { run: (_id, fn) => fn() }

export interface FakePromotionalPro extends PromotionalPro {
  accessEnd: Map<string, Date>
  grants: Array<{ userId: string; endsAt: Date }>
  failNext: number
}

export function createFakePromotionalPro(): FakePromotionalPro {
  const fake: FakePromotionalPro = {
    accessEnd: new Map(),
    grants: [],
    failNext: 0,
    async currentAccessEnd(userId) {
      return fake.accessEnd.get(userId) ?? null
    },
    async grantUntil(userId, endsAt) {
      if (fake.failNext > 0) {
        fake.failNext--
        throw new Error('provedor fora do ar')
      }
      fake.grants.push({ userId, endsAt })
      fake.accessEnd.set(userId, endsAt)
    },
  }
  return fake
}
