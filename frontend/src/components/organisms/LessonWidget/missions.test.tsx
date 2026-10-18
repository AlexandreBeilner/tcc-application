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
    {
        lesson: '1.5',
        widget: 'fgc-coverage-bar',
        initial: { amountPerInstitution: 300000, institutions: 2, sameConglomerate: false, totalAmount: 600000 },
        goal: { metric: 'uncoveredAmount', op: 'lte', value: 0 },
        showMe: { institutions: 3 },
    },
    {
        lesson: '1.6',
        widget: 'ir-regressive-table',
        initial: { grossYield: 1000, initialDays: 90 },
        goal: { metric: 'irRatePct', op: 'lte', value: 15 },
        showMe: { initialDays: 721 },
    },
    {
        lesson: '1.7',
        widget: 'equivalent-rate',
        initial: { exemptRatePct: 9, cdbRatePct: 11, daysPresets: [180, 800] },
        goal: { metric: 'cdbGapPct', op: 'between', min: -0.05, max: 0.05 },
        showMe: { cdbRatePct: 11.61 },
    },
    {
        lesson: '1.8',
        widget: 'bond-price-calculator',
        initial: { ratePct: 11.75, years: 1, amount: 10000 },
        goal: { metric: 'unitPrice', op: 'lt', value: 800 },
        showMe: { years: 2.5 },
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

    it('1.5: com o total fixo em R$ 600 mil, só fecha dividindo em 3 ou mais instituições diferentes', () => {
        const uncovered = (institutions: number, sameConglomerate: boolean) =>
            metricsOf('fgc-coverage-bar', { amountPerInstitution: 0, institutions, sameConglomerate, totalAmount: 600000 }).uncoveredAmount
        // 2 x 300 mil: R$ 50 mil de cada fora do limite de R$ 250 mil.
        expect(uncovered(2, false)).toBe(100000)
        // 3 x 200 mil e 6 x 100 mil cabem no limite por instituição e no teto de R$ 1 milhão.
        expect(uncovered(3, false)).toBe(0)
        expect(uncovered(6, false)).toBe(0)
        // No mesmo conglomerado os valores se somam antes do limite: sobram R$ 350 mil de fora.
        expect(uncovered(3, true)).toBe(350000)
    })

    it('1.6: a menor alíquota (15%) começa no 721º dia, e 720 dias ainda pagam 17,5%', () => {
        const rate = (initialDays: number) => metricsOf('ir-regressive-table', { grossYield: 1000, initialDays }).irRatePct
        expect(rate(720)).toBe(17.5)
        expect(rate(721)).toBe(15)
        expect(rate(1000)).toBe(15)
    })

    it('1.7: no prazo de 180 dias (IR de 22,5%) o empate com a LCI de 9% fica em cerca de 11,61%', () => {
        const gap = (cdbRatePct: number) =>
            metricsOf('equivalent-rate', { exemptRatePct: 9, cdbRatePct, daysPresets: [180, 800] }).cdbGapPct
        // 9 / (1 - 0,225) = 11,6129: abaixo disso a LCI vence, acima o CDB vence.
        expect(gap(11)).toBeCloseTo(-0.475, 3)
        expect(gap(11.6)).toBeCloseTo(-0.01, 3)
        expect(gap(11.61)).toBeCloseTo(-0.00225, 4)
        expect(gap(11.62)).toBeCloseTo(0.0055, 4)
        expect(gap(12)).toBeGreaterThan(0.05)
    })

    it('1.8: a 11,75% ao ano o título passa a custar menos de R$ 800 só depois de 2 anos (2 anos dão R$ 800,76)', () => {
        const price = (years: number, ratePct = 11.75) => metricsOf('bond-price-calculator', { ratePct, years, amount: 10000 }).unitPrice
        // 1000 / 1,1175^t
        expect(price(1)).toBeCloseTo(894.9, 1)
        expect(price(2)).toBeCloseTo(800.76, 2)
        expect(price(2.25)).toBeLessThan(800)
        expect(price(2.5)).toBeCloseTo(757.4, 0)
        // Taxa maior no prazo de 2 anos também derruba o preço: 12% dão R$ 797,19.
        expect(price(2, 12)).toBeLessThan(800)
    })
})
