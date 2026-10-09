import type { Snapshot } from '../../domain/networth'

export interface ValuationSample {
  userId: string
  snapshot: Snapshot
}

// Amostras do patrimônio (renda fixa pelo valor de hoje) tiradas logo depois do começo de cada
// janela. O motor não avalia a renda fixa numa data passada, então o "começo da janela" do ranking
// vem daqui, não do replay.
export interface RankingValuationSampleStore {
  saveSamples(computedAt: Date, samples: ValuationSample[]): Promise<void>
  // Por usuário, a amostra MAIS ANTIGA com `computedAt` em [notBefore, notAfter].
  findBaselines(notBefore: Date, notAfter: Date): Promise<Map<string, Snapshot>>
  deleteSamplesBefore(cutoff: Date): Promise<void>
}
