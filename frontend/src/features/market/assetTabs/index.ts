import type { AssetSummary } from '../../../services/market'
import type { AssetTab } from './types'

export type { AssetTab } from './types'

// O backend (`GET /market/assets?type=`) só filtra pelos 11 valores crus do
// enum `asset_type` — quem agrupa nas 6 abas do inventário (4.2 Lista RF,
// 4.4 Lista RV) é o frontend (backlog, tarefa 6.5). `risco/rentabilidade`
// dos 3 grupos de renda fixa segue a mesma taxonomia de
// `features/portfolio/distribution` (6.5, mesma agregação em dois lugares
// documentada uma vez).
export const FIXED_INCOME_TABS: AssetTab[] = [
    { key: 'tesouro', label: 'Tesouro Direto', types: ['tesouro_selic', 'tesouro_prefixado', 'tesouro_ipca'] },
    { key: 'cdb_lca_lci', label: 'CDBs, LCA e LCI', types: ['cdb', 'lca', 'lci'] },
    { key: 'cri_cra', label: 'CRI e CRA', types: ['cri', 'cra'] },
]

export const EQUITY_TABS: AssetTab[] = [
    { key: 'acoes', label: 'Ações', types: ['acao'] },
    { key: 'etfs', label: 'ETFs', types: ['etf'] },
    { key: 'fiis', label: 'FIIs', types: ['fii'] },
]

export function filterAssetsByTab(assets: AssetSummary[], tab: AssetTab): AssetSummary[] {
    return assets.filter((asset) => tab.types.includes(asset.type))
}
