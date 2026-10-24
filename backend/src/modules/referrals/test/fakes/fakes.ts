import type { ReferralRepository } from '../../application/ports/referralRepository'

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
