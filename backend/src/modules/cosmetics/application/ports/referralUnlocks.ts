// Quantas indicações válidas a pessoa tem (módulo `referrals`), pra liberar títulos (MO.7.2).
export interface ReferralUnlocks {
  qualifiedCount(userId: string): Promise<number>
}
