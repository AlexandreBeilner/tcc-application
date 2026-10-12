import type { ReactNode } from 'react'
import type { AssetSummary } from '../../../services/market'

// Papel da coluna no cartão do mobile/tablet (MO.9.5): título (ticker), subtítulo (nome), etiqueta
// (risco, tipo), preço e variação. Coluna sem `slot` vira uma linha "rótulo: valor" no fim do cartão.
export type AssetTableSlot = 'title' | 'subtitle' | 'tag' | 'price' | 'change'

export interface AssetTableColumn {
    key: string
    header: string
    render: (asset: AssetSummary) => ReactNode
    slot?: AssetTableSlot
    align?: 'end'
}

export interface AssetTableProps {
    assets: AssetSummary[]
    columns: AssetTableColumn[]
    onSelect: (asset: AssetSummary) => void
    emptyMessage: string
    // Séries de preço por id de ativo. Passar o objeto (mesmo vazio) liga a coluna/mini gráfico;
    // `undefined` desliga (renda fixa não tem cotação).
    sparklines?: Record<string, number[]>
}
