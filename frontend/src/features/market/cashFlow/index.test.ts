import { describe, expect, it } from 'vitest'
import { cashDirection, eventTotalValue } from '.'

describe('cashFlow', () => {
    it.each([
        ['initial_deposit', 'in'],
        ['sell_order_executed', 'in'],
        ['fixed_income_redemption', 'in'],
        ['dividend_payment', 'in'],
        ['salary_payment', 'in'],
        ['admin_credit', 'in'],
        ['buy_order_executed', 'out'],
        ['fixed_income_purchase', 'out'],
        ['bot_initial_cash', null],
        ['assembly_decision', null],
        ['etf_creation', null],
    ] as const)('%s -> %s', (type, direction) => {
        expect(cashDirection(type)).toBe(direction)
    })

    it('total: unitário x quantidade, ou o próprio valor sem quantidade', () => {
        expect(eventTotalValue({ unit_value: 30, quantity: 10 })).toBe(300)
        expect(eventTotalValue({ unit_value: 10000 })).toBe(10000)
        expect(eventTotalValue({})).toBeUndefined()
    })
})
