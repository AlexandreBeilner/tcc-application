const MS_PER_DAY = 1000 * 60 * 60 * 24

// Dias corridos entre agora e `isoDate` — insumo de `days_held` pro
// simulador de aporte (tela 4.3, `GET /market/fixed-income/simulate`,
// `.docs/engine/fixedincome.md`: "DU restante... calculado a partir do
// relógio de parede", mesma convenção de dias corridos usada pelo IR
// regressivo). Nunca negativo — um ativo já vencido simula 1 dia (o motor
// exige `days_held > 0`).
export function daysUntil(isoDate: string, now: Date = new Date()): number {
    const target = new Date(isoDate)
    const diff = Math.round((target.getTime() - now.getTime()) / MS_PER_DAY)
    return Math.max(1, diff)
}
