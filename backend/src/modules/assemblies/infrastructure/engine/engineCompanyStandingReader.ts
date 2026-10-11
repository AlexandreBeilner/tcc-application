import type { CompanyStandingReader } from '../../application/ports/companyStandingReader'
import { EngineGovernanceError, engineJson } from './engineClient'

// Espelha `GET /governance/companies/{id}/standing` (`.docs/engine/governance.md`).
interface StandingResponse {
  company_id: string
  name: string
  sector: string
  holds_shares: boolean
  cooldown_days_left: number
}

export function createEngineCompanyStandingReader(engineUrl: string): CompanyStandingReader {
  return {
    async get(companyId, userId) {
      try {
        const res = await engineJson<StandingResponse>(
          `${engineUrl}/governance/companies/${encodeURIComponent(companyId)}/standing?user_id=${encodeURIComponent(userId)}`,
        )
        return {
          companyId: res.company_id,
          name: res.name,
          sector: res.sector,
          holdsShares: res.holds_shares,
          cooldownDaysLeft: res.cooldown_days_left,
        }
      } catch (err) {
        if (err instanceof EngineGovernanceError && err.status === 404) return null
        throw err
      }
    },
  }
}
