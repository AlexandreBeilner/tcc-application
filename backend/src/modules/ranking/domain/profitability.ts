export function profitabilityPct(baseline: number, current: number): number {
  // Guarda defensiva — baseline nunca deveria ser 0 na prática (toda conta
  // nasce com R$10.000, RNF06), mas divisão por zero não pode virar
  // Infinity/NaN numa resposta pública de ranking.
  if (baseline === 0) {
    return 0
  }
  return ((current - baseline) / baseline) * 100
}
