// Salário mensal simulado (Fase T) — cresce com o nível de gamificação
// (`gamification.levelForXp`), em degraus sem teto: nível 1-10 soma
// R$100/nível, nível 11-20 soma R$200/nível, nível 21-30 soma R$300/nível, e
// assim por adiante (tier `k = ceil(nível/10)`, incremento por nível dentro
// do tier = R$100×k). Decisão do autor (2026-09-27, ver backlog Fase T):
// nível 10 → R$1.000/mês, nível 20 → R$3.000/mês, nível 30 → R$6.000/mês.
export function monthlySalaryForLevel(level: number): number {
  const tier = Math.ceil(level / 10)
  const fullTiersSum = (1000 * (tier - 1) * tier) / 2
  const levelsIntoTier = level - 10 * (tier - 1)
  return fullTiersSum + 100 * tier * levelsIntoTier
}
