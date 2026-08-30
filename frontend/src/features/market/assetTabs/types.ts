import type { AssetType } from '../../../services/market'

export interface AssetTab {
    key: string
    label: string
    types: AssetType[]
}
