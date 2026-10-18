import type { PollState } from '../../../services/lessons'

// Frase abaixo das barras da enquete (LJ.2.6, LJ-D5): com resultado, quantos escolheram como a pessoa; sem ele
// (menos de 20 votos), um convite, nunca uma porcentagem de meia dúzia de gente.
export function pollSummary(state: PollState): string {
    if (!state.results) return 'Você está entre os primeiros a responder.'
    const own = state.results.percentages[state.vote] ?? 0
    return own >= 100 ? 'Todo mundo respondeu como você.' : `${own}% responderam como você.`
}
