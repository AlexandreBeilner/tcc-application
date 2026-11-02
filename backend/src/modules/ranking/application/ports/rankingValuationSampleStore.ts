import type { Snapshot } from '../../domain/networth'

export interface ValuationSample {
  userId: string
  snapshot: Snapshot
}

// Amostra escolhida como começo de janela: o patrimônio e o instante em que foi tirada (o `T` do
// retorno ponderado pelo tempo conta a partir dele).
export interface BaselineSample {
  snapshot: Snapshot
  computedAt: Date
}

// Amostras do patrimônio (renda fixa pelo valor de hoje) tiradas logo depois do começo de cada
// janela. O motor não avalia a renda fixa numa data passada, então o "começo da janela" do ranking
// vem daqui, não do replay.
export interface RankingValuationSampleStore {
  saveSamples(computedAt: Date, samples: ValuationSample[]): Promise<void>
  // Por usuário, a amostra MAIS ANTIGA com `computedAt` em [notBefore, notAfter].
  findBaselines(notBefore: Date, notAfter: Date): Promise<Map<string, BaselineSample>>
  deleteSamplesBefore(cutoff: Date): Promise<void>
}
