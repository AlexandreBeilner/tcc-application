import type { PlayerCard } from '../playerCards'

export type MarkerState = 'pending' | 'first-try' | 'later'

export interface ProgressMarker {
    // Posição (1 a `total`) do cartão de pergunta na lição inteira.
    position: number
    state: MarkerState
}

export interface LessonProgress {
    // Cartão atual na lição inteira, de 1 a `total`.
    current: number
    // Cartões das três fases mais a tela final.
    total: number
}

// Posição na lição inteira (LJ.1.1): soma os cartões das fases anteriores ao da fase atual e conta a tela
// final como o último cartão. `phaseCardCounts` são os cartões de Cenário, Micro-decisão e Revelação.
export function lessonProgress(phaseCardCounts: number[], step: number, card: number): LessonProgress {
    const counts = phaseCardCounts.map((count) => Math.max(count, 0))
    const total = counts.reduce((sum, count) => sum + count, 0) + 1
    if (step >= counts.length) {
        return { current: total, total }
    }
    const before = counts.slice(0, step).reduce((sum, count) => sum + count, 0)
    const inside = Math.min(Math.max(card, 0), Math.max(counts[step] - 1, 0))
    return { current: before + inside + 1, total }
}

// Id do que vale ponto no cartão: a pergunta, ou o widget com missão (LJ.3.1). Cartão de leitura não tem.
export function scoredCardId(card: PlayerCard): string | undefined {
    if (card.kind === 'check') return card.block.id
    if (card.kind === 'widget' && card.block.goal) return card.block.id
    return undefined
}

// Um marco por cartão de pergunta ou de missão, na ordem da lição. `stateFor` recebe o id do bloco; devolver
// `undefined` tira o cartão da conta (missão em revisão, que não grava nada).
export function progressMarkers(phases: PlayerCard[][], stateFor: (checkpointId: string) => MarkerState | undefined): ProgressMarker[] {
    const markers: ProgressMarker[] = []
    let position = 0
    for (const cards of phases) {
        for (const card of cards) {
            position += 1
            const id = scoredCardId(card)
            const state = id === undefined ? undefined : stateFor(id)
            if (state !== undefined) {
                markers.push({ position, state })
            }
        }
    }
    return markers
}
