import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { LessonWidget, widgetRegistry } from '.'
import type { WidgetId } from '../../../features/lessons/widgets/schema'
import type { WidgetBlock } from '../../../features/lessons/widgets/schema'
import type { MissionOutcome } from '../../../features/lessons/useWidgetMission'
import { WIDGET_MISSION_METRICS } from '../../../features/lessons/widgets/goal'

const realReturn = (override: Partial<NonNullable<WidgetBlock['goal']>> = {}): WidgetBlock => ({
    type: 'widget',
    id: 'juro-real',
    widget: 'real-return',
    props: { nominalPct: 8, inflationPct: 5, amount: 10000 },
    goal: {
        text: 'Deixe o rendimento real negativo',
        metric: 'realReturnPct',
        op: 'lt',
        value: 0,
        reveal: 'a inflação passou o rendimento.',
        showMe: { inflationPct: 12 },
        ...override,
    },
})

describe('LessonWidget com missão', () => {
    it('mostra a missão, e atingir o alvo mexendo no controle completa e anuncia o que se descobriu', () => {
        const onComplete = vi.fn()
        render(<LessonWidget block={realReturn()} mission={{ outcome: undefined, onComplete }} />)

        expect(screen.getByText(/Missão:/)).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText(/Inflação:/), { target: { value: '9' } })

        expect(onComplete).toHaveBeenCalledWith('juro-real', 'first-try')
    })

    it('com o resultado já guardado mostra a revelação em região anunciada', () => {
        render(<LessonWidget block={realReturn()} mission={{ outcome: 'first-try', onComplete: vi.fn() }} />)
        expect(screen.getByRole('status')).toHaveTextContent('a inflação passou o rendimento.')
    })

    it('"Me mostra" leva os controles ao alvo e conta como não de primeira', () => {
        let outcome: MissionOutcome | undefined
        const onComplete = vi.fn((_id: string, result: MissionOutcome) => {
            outcome = result
        })
        const { rerender } = render(<LessonWidget block={realReturn()} mission={{ outcome, onComplete }} />)
        for (let i = 0; i < 6; i++) fireEvent.change(screen.getByLabelText(/Rendimento nominal:/), { target: { value: String(9 + i) } })

        fireEvent.click(screen.getByRole('button', { name: 'Me mostra' }))
        expect(onComplete).toHaveBeenLastCalledWith('juro-real', 'later')

        rerender(<LessonWidget block={realReturn()} mission={{ outcome, onComplete }} />)
        expect(screen.getByLabelText(/Inflação:/)).toHaveValue('12')
        expect(screen.getByRole('status')).toHaveTextContent('Aqui está.')
        expect(screen.queryByRole('button', { name: 'Me mostra' })).not.toBeInTheDocument()
    })

    it('sem controlador (prévia) guarda o estado sozinho', () => {
        render(<LessonWidget block={realReturn()} />)
        fireEvent.change(screen.getByLabelText(/Inflação:/), { target: { value: '9' } })
        expect(screen.getByRole('status')).toHaveTextContent('a inflação passou o rendimento.')
    })

    it('métrica que o widget não declara é ignorada: widget sem missão', () => {
        render(<LessonWidget block={realReturn({ metric: 'inventada' })} />)
        expect(screen.queryByText(/Missão:/)).not.toBeInTheDocument()
        expect(screen.getByLabelText(/Inflação:/)).toBeInTheDocument()
    })

    it('widget sem goal continua igual', () => {
        render(<LessonWidget block={{ ...realReturn(), goal: undefined }} />)
        expect(screen.queryByText(/Missão:/)).not.toBeInTheDocument()
    })
})

// Quebra se um widget renomear (ou parar de informar) a métrica que a missão usa (LJ.3.1).
describe('métricas declaradas pelos widgets', () => {
    const cases: [WidgetId, Record<string, unknown>][] = [
        ['real-return', { nominalPct: 8, inflationPct: 5, amount: 10000 }],
        ['savings-vs-selic', { selicPct: 14, trMonthlyPct: 0.15, amount: 10000, months: 12 }],
        ['growth-calculator', { initialCapital: 1000, ratePct: 10, periodYears: 15 }],
    ]

    it.each(cases)('%s informa exatamente as métricas declaradas', (widget, props) => {
        const onMetrics = vi.fn()
        const Component = widgetRegistry[widget].component as ComponentType<Record<string, unknown>>
        render(<Component {...props} onMetrics={onMetrics} />)

        expect(onMetrics).toHaveBeenCalled()
        expect(Object.keys(onMetrics.mock.calls[0][0]).sort()).toEqual([...(WIDGET_MISSION_METRICS[widget] ?? [])].sort())
    })

    it('growth-calculator: 10% ao ano por 15 anos passa do dobro dos juros simples, e por 1 ano não', () => {
        const onMetrics = vi.fn()
        const Component = widgetRegistry['growth-calculator'].component as ComponentType<Record<string, unknown>>
        render(<Component initialCapital={1000} ratePct={10} periodYears={1} onMetrics={onMetrics} />)
        expect(onMetrics.mock.calls[0][0].interestRatio).toBeCloseTo(1, 5)

        onMetrics.mockClear()
        render(<Component initialCapital={1000} ratePct={10} periodYears={15} onMetrics={onMetrics} />)
        // (1,1^15 - 1) / (0,1 * 15) = 3,1772 / 1,5
        expect(onMetrics.mock.calls[0][0].interestRatio).toBeCloseTo(2.1181, 3)
    })

    it('savings-vs-selic: a diferença fica perto de zero com Selic em 10%, no primeiro ano', () => {
        const onMetrics = vi.fn()
        const Component = widgetRegistry['savings-vs-selic'].component as ComponentType<Record<string, unknown>>
        render(<Component selicPct={10} trMonthlyPct={0.15} amount={10000} months={12} onMetrics={onMetrics} />)
        expect(Math.abs(onMetrics.mock.calls[0][0].savingsGapPct)).toBeLessThan(0.25)
    })
})
