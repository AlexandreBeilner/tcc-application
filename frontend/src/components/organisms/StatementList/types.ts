import type { MarketEvent } from '../../../services/market'

export interface StatementListProps {
    events: MarketEvent[]
    // Mapa `asset_id` (UUID) → "TICKER · Nome", construído a partir de
    // `GET /market/assets` — `market_events` (proxy 1:1 do motor,
    // `.docs/backend/market.md`) só traz o UUID, sem ticker/nome.
    assetLabels?: Record<string, string>
    // Ids dos ativos do Modo Aprendizado. O Sandbox não mexe no caixa (ponto 063), então o valor
    // desses eventos aparece neutro, sem seta de dinheiro entrando ou saindo.
    sandboxAssetIds?: Set<string>
}
