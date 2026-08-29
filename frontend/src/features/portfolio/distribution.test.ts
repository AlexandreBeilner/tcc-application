import { describe, expect, it } from 'vitest'
import { groupPositionsByCategory } from './distribution'

describe('groupPositionsByCategory', () => {
    it('agrupa por categoria e calcula percentual sobre o total', () => {
        const slices = groupPositionsByCategory(
            [
                { type: 'acao', quantity: 10, averagePrice: 10 }, // 100
                { type: 'etf', quantity: 5, averagePrice: 20 }, // 100
            ],
            [{ type: 'tesouro_selic', quantity: 1, averagePrice: 200 }], // 200
        )

        expect(slices).toEqual([
            { category: 'tesouro', label: 'Tesouro Direto', value: 200, percentage: 0.5 },
            { category: 'acao', label: 'Ações', value: 100, percentage: 0.25 },
            { category: 'etf', label: 'ETFs', value: 100, percentage: 0.25 },
        ])
    })

    it('agrupa tesouro_selic/prefixado/ipca na mesma categoria', () => {
        const slices = groupPositionsByCategory(
            [],
            [
                { type: 'tesouro_selic', quantity: 1, averagePrice: 100 },
                { type: 'tesouro_prefixado', quantity: 1, averagePrice: 100 },
                { type: 'tesouro_ipca', quantity: 1, averagePrice: 100 },
            ],
        )

        expect(slices).toEqual([{ category: 'tesouro', label: 'Tesouro Direto', value: 300, percentage: 1 }])
    })

    it('agrupa cdb/lca/lci e cri/cra em categorias próprias', () => {
        const slices = groupPositionsByCategory(
            [],
            [
                { type: 'cdb', quantity: 1, averagePrice: 50 },
                { type: 'lca', quantity: 1, averagePrice: 50 },
                { type: 'lci', quantity: 1, averagePrice: 50 },
                { type: 'cri', quantity: 1, averagePrice: 25 },
                { type: 'cra', quantity: 1, averagePrice: 25 },
            ],
        )

        expect(slices).toEqual([
            { category: 'cdbLcaLci', label: 'CDB / LCA / LCI', value: 150, percentage: 0.75 },
            { category: 'criCra', label: 'CRI / CRA', value: 50, percentage: 0.25 },
        ])
    })

    it('sem posições devolve lista vazia', () => {
        expect(groupPositionsByCategory([], [])).toEqual([])
    })

    it('mantém a ordem fixa da categoria, não a ordem por valor', () => {
        const slices = groupPositionsByCategory(
            [{ type: 'fii', quantity: 100, averagePrice: 10 }], // maior valor, última categoria
            [{ type: 'tesouro_selic', quantity: 1, averagePrice: 10 }], // menor valor, primeira categoria
        )

        expect(slices.map((slice) => slice.category)).toEqual(['tesouro', 'fii'])
    })
})
