// Espelha `selic.CopomMeetingIntervalDays` (`engine/internal/domain/selic/
// copom.go`) — cadência fixa das reuniões simuladas do Copom, sem endpoint
// próprio que devolva a data da próxima (o motor só marca o dia em que ela
// JÁ aconteceu, via `IsCopomMeetingDay`). Duplicar a constante aqui é
// deliberado: é um número fixo do motor, não um dado que precise de round-
// trip de rede pra ser previsto a partir do último `simulated_day`
// conhecido.
export const COPOM_MEETING_INTERVAL_DAYS = 21

// `selic.IsCopomMeetingDay(dayIndex)` (0-based) é `true` quando
// `(dayIndex+1) % 21 === 0` — e `simulated_day` persistido é sempre
// `dayIndex+1` (tick.Advance, `newDay := current.Day + 1`). Ou seja, um
// `simulated_day` é dia de reunião quando é múltiplo de 21. O próximo
// múltiplo estritamente maior que `lastSimulatedDay` é sempre a próxima
// reunião — mesmo se `lastSimulatedDay` for 0 (motor nunca rodou) ou já
// for ele próprio um dia de reunião.
export function nextCopomSimulatedDay(lastSimulatedDay: number): number {
    return (Math.floor(lastSimulatedDay / COPOM_MEETING_INTERVAL_DAYS) + 1) * COPOM_MEETING_INTERVAL_DAYS
}
