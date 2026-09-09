import { formatCurrency } from '../../portfolio/format'
import type { Achievement } from '../../../services/achievements'

const UNIT_LABEL: Record<Exclude<Achievement['criteriaType'], 'net_worth'>, (value: number) => string> = {
    streak_days: (value) => `${value === 1 ? 'dia' : 'dias'}`,
    lessons_completed: (value) => `${value === 1 ? 'lição' : 'lições'}`,
    trades_executed: (value) => `${value === 1 ? 'operação' : 'operações'}`,
    micro_decisions_streak: (value) => `${value === 1 ? 'acerto seguido' : 'acertos seguidos'}`,
    track_completed_no_errors: (value) => `${value === 1 ? 'trilha sem erro' : 'trilhas sem erro'}`,
    lesson_reviewed: (value) => `${value === 1 ? 'lição revisada' : 'lições revisadas'}`,
}

// Tela 7.2 — "clique numa conquista bloqueada mostra progresso atual em
// relação ao critério" (inventário), ex: "streak 3/7 dias". `net_worth`
// ganha formatação monetária (`formatCurrency`); os outros 3 critérios são
// contagens simples, com plural condicional no rótulo.
export function describeAchievementProgress(achievement: Pick<Achievement, 'criteriaType' | 'criteriaValue' | 'progress'>): string {
    const { criteriaType, criteriaValue, progress } = achievement

    if (criteriaType === 'net_worth') {
        return `${formatCurrency(progress)} de ${formatCurrency(criteriaValue)}`
    }

    return `${progress} de ${criteriaValue} ${UNIT_LABEL[criteriaType](criteriaValue)}`
}
