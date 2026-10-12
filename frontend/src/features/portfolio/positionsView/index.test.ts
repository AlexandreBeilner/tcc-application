import { describe, expect, it } from 'vitest'
import type { PositionReturn } from '../positionReturns'
import { filterAndSortPositions, parsePositionFilter, parsePositionSort, positionDetailPath } from '.'

function row(over: Partial<PositionReturn>): PositionReturn {
    return {
        assetId: 'a',
        ticker: 'AAA1',
        name: 'A',
        type: 'acao',
        category: 'acao',
        isSandbox: false,
        isFixedIncome: false,
        quantity: 1,
        averagePrice: 10,
        cost: 10,
        currentValue: 10,
        valued: true,
        resultAmount: 0,
        resultRatio: 0,
        dividendsReceived: 0,
        totalResultAmount: 0,
        totalResultRatio: 0,
        weight: 0,
        ...over,
    }
}

const rows = [
    row({ assetId: '1', ticker: 'VALE3', currentValue: 300, resultRatio: 0.1 }),
    row({ assetId: '2', ticker: 'HGLG11', type: 'fii', category: 'fii', currentValue: 500, resultRatio: -0.05 }),
    row({ assetId: '3', ticker: 'CDB1', type: 'cdb', category: 'cdbLcaLci', isFixedIncome: true, currentValue: 100, resultRatio: null }),
    row({ assetId: '4', ticker: 'BOVA11', type: 'etf', category: 'etf', currentValue: 200, resultRatio: 0.2 }),
]

describe('positionsView', () => {
    it.each([
        ['todas', ['2', '1', '4', '3']],
        ['acoes', ['1']],
        ['fiis', ['2']],
        ['etfs', ['4']],
        ['rendaFixa', ['3']],
    ] as const)('filtro %s, ordenado por valor', (filter, ids) => {
        expect(filterAndSortPositions(rows, filter, 'valor').map((r) => r.assetId)).toEqual(ids)
    })

    it('ordena por resultado % (nulo no fim) e por ticker', () => {
        expect(filterAndSortPositions(rows, 'todas', 'resultado').map((r) => r.assetId)).toEqual(['4', '1', '2', '3'])
        expect(filterAndSortPositions(rows, 'todas', 'ticker').map((r) => r.ticker)).toEqual(['BOVA11', 'CDB1', 'HGLG11', 'VALE3'])
    })

    it('valores inválidos da URL caem no padrão', () => {
        expect(parsePositionFilter('xyz')).toBe('todas')
        expect(parsePositionFilter(null)).toBe('todas')
        expect(parsePositionFilter('fiis')).toBe('fiis')
        expect(parsePositionSort('xyz')).toBe('valor')
    })

    it('rota do ativo: renda fixa tem tela própria', () => {
        expect(positionDetailPath({ assetId: 'x', isFixedIncome: true })).toBe('/mercado/renda-fixa/x')
        expect(positionDetailPath({ assetId: 'x', isFixedIncome: false })).toBe('/mercado/ativos/x')
    })
})
