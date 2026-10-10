export interface DuelPerformance {
  // Só percentual do período (RNF09).
  returnPct: number
  // Operou (renda variável ou fixa) dentro do período.
  operated: boolean
}

// Rentabilidade de uma pessoa entre dois instantes, lida do módulo `ranking` (replay do log de
// eventos nas duas pontas).
export interface DuelPerformanceReader {
  measure(userId: string, from: Date, to: Date): Promise<DuelPerformance>
}
