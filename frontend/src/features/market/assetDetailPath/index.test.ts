import { describe, expect, it } from 'vitest'
import { assetDetailPath } from '.'

describe('assetDetailPath', () => {
    it('renda fixa vai pra /mercado/renda-fixa/:id', () => {
        expect(assetDetailPath({ id: 'a1', type: 'tesouro_selic' })).toBe('/mercado/renda-fixa/a1')
        expect(assetDetailPath({ id: 'a2', type: 'cdb' })).toBe('/mercado/renda-fixa/a2')
        expect(assetDetailPath({ id: 'a3', type: 'cri' })).toBe('/mercado/renda-fixa/a3')
    })

    it('ação/ETF/FII vão pra /mercado/ativos/:id', () => {
        expect(assetDetailPath({ id: 'a4', type: 'acao' })).toBe('/mercado/ativos/a4')
        expect(assetDetailPath({ id: 'a5', type: 'etf' })).toBe('/mercado/ativos/a5')
        expect(assetDetailPath({ id: 'a6', type: 'fii' })).toBe('/mercado/ativos/a6')
    })
})
