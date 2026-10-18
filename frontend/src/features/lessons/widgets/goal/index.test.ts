import { describe, expect, it } from 'vitest'
import { goalMet, widgetGoalSchema } from '.'
import type { WidgetGoal } from '.'

const goal = (override: Partial<WidgetGoal>): WidgetGoal => ({ text: 't', metric: 'm', op: 'gt', value: 0, reveal: 'r', ...override })

describe('goalMet', () => {
    it.each([
        ['lt', { op: 'lt', value: 0 }, -0.1, true],
        ['lt no limite', { op: 'lt', value: 0 }, 0, false],
        ['lte no limite', { op: 'lte', value: 0 }, 0, true],
        ['gt no limite', { op: 'gt', value: 2 }, 2, false],
        ['gte no limite', { op: 'gte', value: 2 }, 2, true],
        ['between dentro', { op: 'between', min: -1, max: 1 }, 0.5, true],
        ['between no limite', { op: 'between', min: -1, max: 1 }, 1, true],
        ['between fora', { op: 'between', min: -1, max: 1 }, 1.01, false],
        ['sem value', { op: 'gt', value: undefined }, 5, false],
    ] as const)('%s', (_name, override, current, expected) => {
        expect(goalMet(goal(override), { m: current })).toBe(expected)
    })

    it('métrica ausente ou inválida nunca cumpre', () => {
        expect(goalMet(goal({ op: 'lt', value: 10 }), {})).toBe(false)
        expect(goalMet(goal({ op: 'lt', value: 10 }), { m: Number.NaN })).toBe(false)
    })
})

describe('widgetGoalSchema', () => {
    it('aceita a missão completa e recusa op desconhecida', () => {
        expect(widgetGoalSchema.safeParse(goal({ showMe: { selicPct: 10 } })).success).toBe(true)
        expect(widgetGoalSchema.safeParse({ ...goal({}), op: 'eq' }).success).toBe(false)
    })
})
