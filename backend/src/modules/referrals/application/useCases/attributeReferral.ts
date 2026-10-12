import { parseReferralCode } from '../../domain/referral'
import type { ReferralRepository } from '../ports/referralRepository'

// Liga uma conta recém-criada a quem a indicou. Nunca derruba o cadastro nem avisa a pessoa de
// um código ruim: código inválido, desconhecido, o da própria conta ou conta já indicada são
// ignorados em silêncio. Devolve se a indicação foi registrada.
export class AttributeReferralUseCase {
  constructor(private readonly referrals: ReferralRepository) {}

  async execute(referredId: string, rawCode: unknown): Promise<boolean> {
    const code = parseReferralCode(rawCode)
    if (!code) return false
    const referrerId = await this.referrals.findUserByCode(code)
    if (!referrerId || referrerId === referredId) return false
    return this.referrals.createReferral(referrerId, referredId)
  }
}
