// Retenção dos eventos de funil (ponto 048): apagar o que passou do prazo.
export interface FunnelRetention {
  // Apaga os eventos anteriores a `cutoff`; devolve quantos.
  purgeOlderThan(cutoff: Date): Promise<number>
}
