import type { ReactNode } from 'react'
import type { AssetSummary } from '../../../services/market'

export interface AssetTableColumn {
    key: string
    header: string
    render: (asset: AssetSummary) => ReactNode
}

export interface AssetTableProps {
    assets: AssetSummary[]
    columns: AssetTableColumn[]
    onSelect: (asset: AssetSummary) => void
    emptyMessage: string
}
