import type { LessonCardFunnel, LessonCardFunnelBar } from '../../../services/admin'
import { LESSON_STEP_LABELS, formatRate } from '../lessonCatalog'

// Janelas oferecidas na tela (dias contando hoje).
export const FUNNEL_WINDOWS = [7, 30, 90] as const
export const DEFAULT_FUNNEL_WINDOW = 30

const FINAL_PHASE = 3

// "Cenário · cartão 3" / "Tela final". Os rótulos de fase são os do progresso gravado.
export function cardLabel(bar: Pick<LessonCardFunnelBar, 'phase' | 'card_index'>): string {
    if (bar.phase === FINAL_PHASE) return 'Tela final'
    return `${LESSON_STEP_LABELS[bar.phase] ?? 'Fase'} · cartão ${bar.card_index + 1}`
}

// Largura da barra em % da maior contagem da lição (o primeiro cartão costuma ser o maior).
export function barPercent(reached: number, max: number): number {
    return max > 0 ? Math.round((reached / max) * 100) : 0
}

export function isBiggestDrop(funnel: LessonCardFunnel, bar: LessonCardFunnelBar): boolean {
    return funnel.biggest_drop?.phase === bar.phase && funnel.biggest_drop.card_index === bar.card_index
}

// Uma frase com o resumo do funil: quantos começaram, quantos chegaram ao fim e onde mais gente parou.
export function summarizeFunnel(funnel: LessonCardFunnel): string {
    const first = funnel.bars[0]
    if (!first) return 'Ninguém chegou a um cartão desta lição na janela.'
    const last = funnel.bars[funnel.bars.length - 1] as LessonCardFunnelBar
    const parts = [`${first.reached} chegaram ao primeiro cartão e ${last.reached} ao último medido.`]
    const drop = funnel.bars.find((bar) => isBiggestDrop(funnel, bar))
    if (drop) {
        parts.push(`Maior queda: ${cardLabel(drop)}, ${drop.lost} a menos que o cartão anterior (${formatRate(drop.lost_rate)}).`)
    } else {
        parts.push('Ninguém parou no meio dos cartões medidos.')
    }
    return parts.join(' ')
}
