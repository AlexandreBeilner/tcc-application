import type { DeclarationSource } from '../../application/ports/declarationSource'
import { EngineGovernanceError, engineJson } from './engineClient'

// Espelha `GET /governance/pending-declarations` e `POST .../{id}/release`
// (`.docs/engine/governance.md`).
interface PendingResponse {
  declarations: Array<{
    id: string
    company_id: string
    name: string
    sector: string
    tickers: string[]
    report_day: number
    days_held: number
    safety_deadline_day: number
    decision_assembly_id: string | null
    release_requested: boolean
  }>
}

export function createEngineDeclarationSource(engineUrl: string): DeclarationSource {
  return {
    async listPending() {
      const res = await engineJson<PendingResponse>(`${engineUrl}/governance/pending-declarations`)
      return res.declarations.map((d) => ({
        id: d.id,
        companyId: d.company_id,
        name: d.name,
        sector: d.sector,
        tickers: d.tickers,
        reportDay: d.report_day,
        daysHeld: d.days_held,
        safetyDeadlineDay: d.safety_deadline_day,
        decisionAssemblyId: d.decision_assembly_id,
        releaseRequested: d.release_requested,
      }))
    },
    async release(id, reason) {
      try {
        await engineJson(`${engineUrl}/governance/pending-declarations/${id}/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      } catch (err) {
        // A declaração que já saiu (prazo de segurança, painel) não existe mais para liberar.
        if (err instanceof EngineGovernanceError && err.status === 404) return
        throw err
      }
    },
  }
}
