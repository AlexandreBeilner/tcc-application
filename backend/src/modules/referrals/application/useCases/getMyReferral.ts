import { generateReferralCode } from '../../domain/referral'
import type { ReferralRepository } from '../ports/referralRepository'

export interface MyReferralView {
  code: string
  qualifiedCount: number
  // Contas que entraram pelo link mas ainda não concluíram a primeira lição.
  pendingCount: number
}

// O código de convite da pessoa (criado na primeira leitura) e quantos convites já valem.
export class GetMyReferralUseCase {
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly randomInt: (maxExclusive: number) => number,
  ) {}

  async execute(userId: string): Promise<MyReferralView> {
    const code = await this.ensureCode(userId)
    const [qualifiedCount, pendingCount] = await Promise.all([
      this.referrals.countQualified(userId),
      this.referrals.countPending(userId),
    ])
    return { code, qualifiedCount, pendingCount }
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
