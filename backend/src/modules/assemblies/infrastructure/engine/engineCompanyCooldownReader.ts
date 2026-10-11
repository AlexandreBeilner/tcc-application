import type { CompanyCooldownReader } from '../../application/ports/companyCooldownReader'
import type { CompanyStandingReader } from '../../application/ports/companyStandingReader'

// O motor só expõe o cooldown na rota de `standing`, que pede um `user_id`. Para a abertura (que
// não tem pessoa) vale o UUID nulo: não tem posição nenhuma, e só o `cooldown_days_left` interessa.
const NO_USER = '00000000-0000-0000-0000-000000000000'

export function createEngineCompanyCooldownReader(
  standings: CompanyStandingReader,
): CompanyCooldownReader {
  return {
    async daysLeft(companyId) {
      const standing = await standings.get(companyId, NO_USER)
      if (!standing) throw new Error(`empresa ${companyId} desconhecida pelo motor`)
      return standing.cooldownDaysLeft
    },
  }
}
