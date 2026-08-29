import { describe, expect, it } from 'vitest'
import { EQUITY_TABS, FIXED_INCOME_TABS, filterAssetsByTab } from '.'
import type { AssetSummary } from '../../../services/market'

function asset(type: AssetSummary['type']): AssetSummary {
    return { id: type, ticker: type.toUpperCase(), name: type, type, is_sandbox: false }
}

describe('features/market/assetTabs', () => {
    it('3 abas de renda fixa cobrem os 8 tipos de renda fixa, sem sobra', () => {
        const allTypes = FIXED_INCOME_TABS.flatMap((tab) => tab.types)
        expect(allTypes.sort()).toEqual(['tesouro_selic', 'tesouro_prefixado', 'tesouro_ipca', 'cdb', 'lca', 'lci', 'cri', 'cra'].sort())
    })

    it('3 abas de renda variável cobrem acao/etf/fii', () => {
        const allTypes = EQUITY_TABS.flatMap((tab) => tab.types)
        expect(allTypes.sort()).toEqual(['acao', 'etf', 'fii'].sort())
    })

    it('filterAssetsByTab devolve só os ativos do tipo da aba', () => {
        const assets = [asset('cdb'), asset('acao'), asset('lci')]
        const tab = FIXED_INCOME_TABS.find((t) => t.key === 'cdb_lca_lci')!

        expect(
            filterAssetsByTab(assets, tab)
                .map((a) => a.type)
                .sort(),
        ).toEqual(['cdb', 'lci'])
    })

    it('filterAssetsByTab devolve lista vazia quando nenhum ativo bate', () => {
        expect(filterAssetsByTab([asset('acao')], FIXED_INCOME_TABS[0])).toEqual([])
    })
})
