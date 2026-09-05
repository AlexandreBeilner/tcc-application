import { useMemo } from 'react'
import type { AssetSummary } from '../../../services/market'

// Extraído de 4 duplicações idênticas (PainelAdmin, MacroEventTriggerForm,
// News, Statement) — todas resolviam `asset_id` (UUID) pra "TICKER · Nome"
// exibível com o mesmo `useMemo` copiado.
export function useAssetLabels(assets: AssetSummary[] | undefined): Record<string, string> {
    return useMemo(() => Object.fromEntries((assets ?? []).map((asset) => [asset.id, `${asset.ticker} · ${asset.name}`])), [assets])
}
