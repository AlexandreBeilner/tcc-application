import type { PlayerCard } from '../playerCards'
import type { MarkerState } from '../lessonProgress'

export interface LessonScore {
    // Perguntas da lição.
    total: number
    // Quantas foram acertadas de primeira.
    firstTry: number
    // Um estado por pergunta, na ordem da lição (a fileira de marcos do placar).
    states: MarkerState[]
}

// Placar da lição (LJ.1.4): um estado por cartão de pergunta, vindo de `stateFor` (o mesmo que alimenta os
// marcos da barra da LJ.1.1). Pergunta sem resposta conta como não acertada de primeira.
export function lessonScore(phases: PlayerCard[][], stateFor: (checkpointId: string) => MarkerState): LessonScore {
    const states = phases.flat().flatMap((card) => (card.kind === 'check' ? [stateFor(card.block.id)] : []))
    return { total: states.length, firstTry: states.filter((state) => state === 'first-try').length, states }
}

// Título do resultado: reconhece o desempenho e nunca é negativo. Todas de primeira é "Na mosca!", a maioria
// é "Mandou bem!" e o resto (ou lição sem perguntas) é só "Lição concluída".
export function scoreTitle({ total, firstTry }: Pick<LessonScore, 'total' | 'firstTry'>): string {
    if (total === 0) return 'Lição concluída'
    if (firstTry === total) return 'Na mosca!'
    if (firstTry * 2 > total) return 'Mandou bem!'
    return 'Lição concluída'
}

export function scoreSummary({ total, firstTry }: Pick<LessonScore, 'total' | 'firstTry'>): string {
    return `${firstTry} de ${total} de primeira`
}
