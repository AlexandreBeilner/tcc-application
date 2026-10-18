import { z } from 'zod'

// Missão de widget (LJ.3.1): espelho do contrato do backend
// (`modules/lessons/domain/widgets/widgetGoal.ts`). O widget informa métricas e quem confere o alvo é
// `goalMet`, sem conhecer a fórmula de cada widget.
export const widgetGoalSchema = z.object({
    text: z.string().min(1),
    metric: z.string().min(1),
    op: z.enum(['lt', 'lte', 'gt', 'gte', 'between']),
    value: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    reveal: z.string().min(1),
    showMe: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
})

export type WidgetGoal = z.infer<typeof widgetGoalSchema>

export type WidgetMetrics = Record<string, number>

// Props que todo widget com missão aceita: informar as métricas a cada mudança.
export interface MissionWidgetProps {
    onMetrics?: (metrics: WidgetMetrics) => void
}

// Métricas que cada widget com missão declara. O teste de cada widget quebra se ele renomear uma delas.
export const WIDGET_MISSION_METRICS: Partial<Record<string, readonly string[]>> = {
    'emergency-fund-calculator': ['monthsToReach'],
    'growth-calculator': ['interestRatio'],
    'real-return': ['realReturnPct'],
    'savings-vs-selic': ['savingsGapPct'],
}

// "Me mostra" (LJ-D4): aparece depois de 2 minutos mexendo sem atingir, ou de 6 interações. Sem cronômetro visível.
export const SHOW_ME_AFTER_MS = 120_000
export const SHOW_ME_AFTER_INTERACTIONS = 6

export function goalMet(goal: WidgetGoal, metrics: WidgetMetrics): boolean {
    const current = metrics[goal.metric]
    if (current === undefined || !Number.isFinite(current)) return false
    switch (goal.op) {
        case 'lt':
            return goal.value !== undefined && current < goal.value
        case 'lte':
            return goal.value !== undefined && current <= goal.value
        case 'gt':
            return goal.value !== undefined && current > goal.value
        case 'gte':
            return goal.value !== undefined && current >= goal.value
        case 'between':
            return goal.min !== undefined && goal.max !== undefined && current >= goal.min && current <= goal.max
    }
}
