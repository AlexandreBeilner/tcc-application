import { FIXED_INCOME_TABS } from '../assetTabs'
import type { AssetType } from '../../../services/market'

const FIXED_INCOME_TYPES = new Set<AssetType>(FIXED_INCOME_TABS.flatMap((tab) => tab.types))

// Rota de detalhe varia por classe de ativo (tela 4.3 vs 4.5/4.7/4.9,
// `routes/router.tsx`) — renda fixa usa `/mercado/renda-fixa/:id`
// (`FixedIncomeDetail`), ação/ETF/FII usam `/mercado/ativos/:id`
// (`AssetDetail`). Reaproveitado pelo CTA "Comprar agora" da lição
// (tarefa 7.0.2) — mesma decisão de roteamento já usada por
// `FixedIncomeList`/`EquityList`/`News`/`CompanyProfile`.
export function assetDetailPath(asset: { id: string; type: AssetType }): string {
    return FIXED_INCOME_TYPES.has(asset.type) ? `/mercado/renda-fixa/${asset.id}` : `/mercado/ativos/${asset.id}`
}
