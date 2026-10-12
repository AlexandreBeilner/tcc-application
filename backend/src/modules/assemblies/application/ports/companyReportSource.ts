// Balanços de empresa já divulgados, vindos do motor (que é dono do calendário de balanços).
export interface CompanyReportFact {
  companyId: string
  name: string
  sector: string
  tickers: string[]
  // Dia simulado em que o balanço saiu e há quantos dias isso foi.
  reportDay: number
  daysSinceReport: number
}

export interface CompanyReportSource {
  // Último balanço de cada empresa, quando saiu entre `minDays` e `maxDays` dias atrás.
  listRecentReports(minDays: number, maxDays: number): Promise<CompanyReportFact[]>
}
