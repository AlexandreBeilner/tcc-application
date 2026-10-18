import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { widgetRegistry } from '.'
import type { WidgetId } from '../../../features/lessons/widgets/schema'
import { WIDGET_MISSION_METRICS, goalMet } from '../../../features/lessons/widgets/goal'
import type { WidgetGoal, WidgetMetrics } from '../../../features/lessons/widgets/goal'

// Missões das Trilhas 1 a 3 e F (LJ.3.4). Cada linha repete o ponto de partida e o alvo que a lição tem no seed
// (`backend/src/db/lessonContent*.ts`): o teste confere, com a conta real do widget, que o ponto de partida NÃO
// cumpre a missão e que o "Me mostra" cumpre. O espelho no backend (`widgetMissions.test.ts`) fixa a mesma tabela.
interface MissionCase {
    lesson: string
    widget: WidgetId
    initial: Record<string, unknown>
    goal: Pick<WidgetGoal, 'metric' | 'op' | 'value' | 'min' | 'max'>
    showMe: Record<string, unknown>
}

const MISSION_CASES: MissionCase[] = [
    {
        lesson: '1.3',
        widget: 'emergency-fund-calculator',
        initial: { monthlyCost: 3000, incomeType: 'variable', monthlyContribution: 500 },
        goal: { metric: 'monthsToReach', op: 'lte', value: 12 },
        showMe: { monthlyContribution: 1500 },
    },
]

// Últimas métricas que o widget informa ao ser montado com essas props.
function metricsOf(widget: WidgetId, props: Record<string, unknown>): WidgetMetrics {
    const onMetrics = vi.fn()
    const Component = widgetRegistry[widget].component as ComponentType<Record<string, unknown>>
    const { unmount } = render(<Component {...props} onMetrics={onMetrics} />)
    unmount()
    expect(onMetrics).toHaveBeenCalled()
    return onMetrics.mock.calls[onMetrics.mock.calls.length - 1][0]
}

describe('missões das Trilhas 1 a 3 e F (LJ.3.4)', () => {
    it.each(MISSION_CASES.map((c) => [`${c.lesson} ${c.widget}`, c] as const))(
        '%s: informa só as métricas declaradas, o ponto de partida não cumpre e o "Me mostra" cumpre',
        (_name, c) => {
            const start = metricsOf(c.widget, c.initial)
            expect(Object.keys(start).sort()).toEqual([...(WIDGET_MISSION_METRICS[c.widget] ?? [])].sort())
            const goal = { ...c.goal, text: 't', reveal: 'r' } as WidgetGoal
            expect(goalMet(goal, start)).toBe(false)

            const shown = metricsOf(c.widget, { ...c.initial, ...c.showMe })
            expect(goalMet(goal, shown)).toBe(true)
        },
    )

    it('1.3: 18.000 de meta em 12 meses pedem 1.500 por mês (11 meses não bastam com 1.400)', () => {
        expect(
            metricsOf('emergency-fund-calculator', { monthlyCost: 3000, incomeType: 'variable', monthlyContribution: 1500 }).monthsToReach,
        ).toBe(12)
        expect(
            metricsOf('emergency-fund-calculator', { monthlyCost: 3000, incomeType: 'variable', monthlyContribution: 1400 }).monthsToReach,
        ).toBe(13)
        // Sem aporte não há prazo: o infinito não cumpre.
        expect(
            metricsOf('emergency-fund-calculator', { monthlyCost: 3000, incomeType: 'variable', monthlyContribution: 0 }).monthsToReach,
        ).toBe(Infinity)
    })
})
