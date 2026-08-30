import type { NewsEventTarget } from '../../../services/news'
import type { ResolvedNewsTarget } from './types'

export type { ResolvedNewsTarget } from './types'

// Só `asset_id` vira navegação real (4.5 Detalhe de Ativo) — resolvido via
// `assetLabels` ("TICKER · Nome"), mesmo padrão de StatementList/Extrato
// (`GET /market/assets`, sem tocar o motor). `sector`/`risk_class` são
// escopos (potencialmente vários ativos, tela 4.2/4.4 não tem filtro por
// nenhum dos dois) — exibidos como texto, sem navegação, decisão da tarefa
// 6.6 pra não inventar uma tela de listagem filtrada não pedida em nenhum
// documento.
export function resolveTargets(targets: NewsEventTarget[], assetLabels: Record<string, string>): ResolvedNewsTarget[] {
    return targets.map((target, index) => {
        if (target.asset_id) {
            return {
                key: `asset-${target.asset_id}`,
                label: assetLabels[target.asset_id] ?? target.asset_id,
                assetId: target.asset_id,
            }
        }
        if (target.sector) {
            return { key: `sector-${index}-${target.sector}`, label: `Setor: ${target.sector}` }
        }
        if (target.risk_class) {
            return { key: `risk-${index}-${target.risk_class}`, label: `Risco: ${target.risk_class}` }
        }
        return { key: `desconhecido-${index}`, label: '—' }
    })
}
