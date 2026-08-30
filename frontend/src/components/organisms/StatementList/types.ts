import type { MarketEvent } from '../../../services/market'

export interface StatementListProps {
    events: MarketEvent[]
    // Mapa `asset_id` (UUID) → "TICKER · Nome", construído a partir de
    // `GET /market/assets` — `market_events` (proxy 1:1 do motor,
    // `.docs/backend/market.md`) só traz o UUID, sem ticker/nome.
    assetLabels?: Record<string, string>
}
