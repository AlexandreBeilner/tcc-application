import type { NewsEvent } from '../../../services/news'

export interface NewsEventListProps {
    events: NewsEvent[]
    // Mapa `asset_id` (UUID) → "TICKER · Nome", mesmo padrão de
    // StatementList/Extrato — `targets` só traz o UUID de ativo, sem
    // ticker/nome (GET /market/assets resolve).
    assetLabels?: Record<string, string>
    // Disparado na primeira expansão de qualquer evento nesta sessão de
    // render — sinal de "leu pelo menos um evento" (auto-report da missão
    // "Consulte o feed de notícias", tarefa 6.6/6.8).
    onEventRead?: () => void
    // Clique num target com asset_id (4.5 Detalhe de Ativo) — a página
    // decide a navegação (useNavigate), mesmo padrão de onSelect em
    // AssetTable/CompanyAssetList (organism não embute react-router).
    onSelectAsset?: (assetId: string) => void
}
