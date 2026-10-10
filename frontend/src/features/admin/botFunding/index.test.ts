import { describe, expect, it } from 'vitest'
import { EMPTY_FUNDING, MAX_FUNDING_QUANTITY, toFundInput, validateFunding } from '.'

describe('botFunding', () => {
    it('exige caixa e/ou posição', () => {
        expect(validateFunding(EMPTY_FUNDING).form).toMatch(/caixa e\/ou uma posição/)
    })

    it('aceita só caixa, com vírgula decimal', () => {
        const values = { ...EMPTY_FUNDING, cash: '1500,50' }
        expect(validateFunding(values)).toEqual({})
        expect(toFundInput(values)).toEqual({ cash: 1500.5 })
    })

    it('aceita só posição', () => {
        const values = { ...EMPTY_FUNDING, assetId: 'a1', quantity: '40' }
        expect(validateFunding(values)).toEqual({})
        expect(toFundInput(values)).toEqual({ holdings: [{ asset_id: 'a1', quantity: 40 }] })
    })

    it('aceita os dois', () => {
        const values = { cash: '100', assetId: 'a1', quantity: '2' }
        expect(toFundInput(values)).toEqual({ cash: 100, holdings: [{ asset_id: 'a1', quantity: 2 }] })
    })

    it.each(['0', '-5', 'abc', '1000000000001'])('recusa caixa %s', (cash) => {
        expect(validateFunding({ ...EMPTY_FUNDING, cash }).cash).toBeDefined()
    })

    it('posição incompleta ou inválida é recusada', () => {
        expect(validateFunding({ ...EMPTY_FUNDING, quantity: '5' }).assetId).toBeDefined()
        expect(validateFunding({ ...EMPTY_FUNDING, assetId: 'a1' }).quantity).toBeDefined()
        for (const quantity of ['0', '1,5', '-1', String(MAX_FUNDING_QUANTITY + 1)]) {
            expect(validateFunding({ ...EMPTY_FUNDING, assetId: 'a1', quantity }).quantity).toBeDefined()
        }
    })
})
