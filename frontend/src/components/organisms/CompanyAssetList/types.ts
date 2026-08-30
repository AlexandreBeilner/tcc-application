import type { CompanyAssetSummary } from '../../../services/market'

export interface CompanyAssetListProps {
    assets: CompanyAssetSummary[]
    onSelect: (asset: CompanyAssetSummary) => void
}
