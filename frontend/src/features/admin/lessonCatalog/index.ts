import { ApiError } from '../../../services/client'
import type { AdminLesson, LessonFunnel, LessonMicroDecisionType } from '../../../services/admin'

// Rótulo de cada tipo de micro-decisão (o widget do passo 2 da lição).
export const MICRO_DECISION_TYPE_LABELS: Record<LessonMicroDecisionType, string> = {
    reflection: 'Reflexão',
    growth_calculator: 'Calculadora de crescimento',
    fixed_income_comparison: 'Comparador de renda fixa',
    live_indicator: 'Indicador de ativo ao vivo',
    live_macro_indicator: 'Indicador macro ao vivo',
}

// Os quatro passos da lição, na ordem em que o progresso é gravado (spec 5.2).
export const LESSON_STEP_LABELS = ['Cenário', 'Micro-decisão', 'Revelação', 'Desbloqueio'] as const

const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

// Taxa de 0 a 1 → "62%", ou "sem dados" quando não há base (ninguém iniciou, lição sem aposta).
export function formatRate(rate: number | null): string {
    return rate === null ? 'sem dados' : percentFormatter.format(rate)
}

// Duração em segundos → "45 s", "3 min" ou "1 h 20 min". `null` vira "sem dados".
export function formatDuration(seconds: number | null): string {
    if (seconds === null) return 'sem dados'
    if (seconds < 60) return `${Math.round(seconds)} s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// Passo onde mais gente parou (e quantos), ou `null` quando ninguém abandonou. Em empate fica o mais cedo.
export function worstAbandonStep(funnel: Pick<LessonFunnel, 'abandoned_by_step'>): { label: string; count: number } | null {
    let best = -1
    funnel.abandoned_by_step.forEach((count, index) => {
        if (count > 0 && (best === -1 || count > funnel.abandoned_by_step[best])) best = index
    })
    return best === -1 ? null : { label: LESSON_STEP_LABELS[best], count: funnel.abandoned_by_step[best] }
}

// Lições agrupadas por trilha, na ordem da trilha.
export function groupLessonsByTrack(lessons: AdminLesson[]): { trackNumber: number; trackName: string; lessons: AdminLesson[] }[] {
    const groups = new Map<number, { trackNumber: number; trackName: string; lessons: AdminLesson[] }>()
    for (const lesson of [...lessons].sort((a, b) => a.sort_order - b.sort_order)) {
        const group = groups.get(lesson.track_number) ?? { trackNumber: lesson.track_number, trackName: lesson.track_name, lessons: [] }
        group.lessons.push(lesson)
        groups.set(lesson.track_number, group)
    }
    return [...groups.values()]
}

// Erro de conteúdo de lição → texto pro admin. As mensagens de 404, 409 e 422 vêm do backend em português.
export function describeLessonError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 400) return 'Dados inválidos. Confira os campos preenchidos.'
        if (err.status === 404 || err.status === 409 || err.status === 422) return err.message
    }
    return 'Não foi possível concluir a ação agora. Tente novamente em instantes.'
}
