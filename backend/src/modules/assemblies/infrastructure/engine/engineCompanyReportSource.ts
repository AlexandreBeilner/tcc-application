import type { CompanyReportSource } from '../../application/ports/companyReportSource'
import { engineJson } from './engineClient'

// Espelha `GET /governance/reports` (`.docs/engine/governance.md`).
interface ReportsResponse {
  reports: Array<{
    company_id: string
    name: string
    sector: string
    tickers: string[]
    report_day: number
    days_since_report: number
  }>
}

export function createEngineCompanyReportSource(engineUrl: string): CompanyReportSource {
  return {
    async listRecentReports(minDays, maxDays) {
      const res = await engineJson<ReportsResponse>(
        `${engineUrl}/governance/reports?min_days=${minDays}&max_days=${maxDays}`,
      )
      return res.reports.map((r) => ({
        companyId: r.company_id,
        name: r.name,
        sector: r.sector,
        tickers: r.tickers,
        reportDay: r.report_day,
        daysSinceReport: r.days_since_report,
      }))
    },
  }
}
