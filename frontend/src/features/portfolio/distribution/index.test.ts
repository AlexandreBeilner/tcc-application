import { describe, expect, it } from 'vitest'
import { calculateAccountTotals } from '../accountTotals'
import { groupPositionsByCategory } from '.'

describe('groupPositionsByCategory', () => {
    it('agrupa por categoria e calcula percentual sobre o total', () => {
        const slices = groupPositionsByCategory(
            [
                { type: 'acao', isSandbox: false, quantity: 10, averagePrice: 10 }, // 100
                { type: 'etf', isSandbox: false, quantity: 5, averagePrice: 20 }, // 100
            ],
            [{ type: 'tesouro_selic', isSandbox: false, quantity: 1, averagePrice: 200 }], // 200
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
                { type: 'tesouro_selic', isSandbox: false, quantity: 1, averagePrice: 100 },
                { type: 'tesouro_prefixado', isSandbox: false, quantity: 1, averagePrice: 100 },
                { type: 'tesouro_ipca', isSandbox: false, quantity: 1, averagePrice: 100 },
            ],
        )

        expect(slices).toEqual([{ category: 'tesouro', label: 'Tesouro Direto', value: 300, percentage: 1 }])
    })

    it('agrupa cdb/lca/lci e cri/cra em categorias próprias', () => {
        const slices = groupPositionsByCategory(
            [],
            [
                { type: 'cdb', isSandbox: false, quantity: 1, averagePrice: 50 },
                { type: 'lca', isSandbox: false, quantity: 1, averagePrice: 50 },
                { type: 'lci', isSandbox: false, quantity: 1, averagePrice: 50 },
                { type: 'cri', isSandbox: false, quantity: 1, averagePrice: 25 },
                { type: 'cra', isSandbox: false, quantity: 1, averagePrice: 25 },
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
            [{ type: 'fii', isSandbox: false, quantity: 100, averagePrice: 10 }], // maior valor, última categoria
            [{ type: 'tesouro_selic', isSandbox: false, quantity: 1, averagePrice: 10 }], // menor valor, primeira categoria
        )

        expect(slices.map((slice) => slice.category)).toEqual(['tesouro', 'fii'])
    })

    it('ignora posição de treino (Sandbox)', () => {
        const slices = groupPositionsByCategory(
            [
                { type: 'acao', isSandbox: false, quantity: 10, averagePrice: 10 },
                { type: 'acao', isSandbox: true, quantity: 100, averagePrice: 50 },
            ],
            [{ type: 'tesouro_prefixado', isSandbox: true, quantity: 1, averagePrice: 500 }],
        )

        expect(slices).toEqual([{ category: 'acao', label: 'Ações', value: 100, percentage: 1 }])
    })

    it('usa o preço de mercado quando existe, senão o preço médio', () => {
        const slices = groupPositionsByCategory(
            [{ type: 'acao', isSandbox: false, quantity: 10, averagePrice: 10, markPrice: 15 }],
            [{ type: 'tesouro_selic', isSandbox: false, quantity: 1, averagePrice: 150 }],
        )

        expect(slices.map((s) => [s.category, s.value])).toEqual([
            ['tesouro', 150],
            ['acao', 150],
        ])
    })

    it('a soma das fatias bate com o liveInvested dos cards', () => {
        const positions = [
            { type: 'acao', isSandbox: false, quantity: 10, averagePrice: 10, markPrice: 12 },
            { type: 'acao', isSandbox: true, quantity: 5, averagePrice: 9 },
        ]
        const fixed = [{ type: 'cdb', isSandbox: false, quantity: 1, averagePrice: 80 }]
        const sum = groupPositionsByCategory(positions, fixed).reduce((acc, s) => acc + s.value, 0)
        expect(sum).toBe(calculateAccountTotals(positions, fixed).liveInvested)
    })
})
