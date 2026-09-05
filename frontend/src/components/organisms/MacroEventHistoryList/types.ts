import type { MacroEvent } from '../../../services/admin'

export interface MacroEventHistoryListProps {
    events: MacroEvent[]
    assetLabels?: Record<string, string>
    onSelectAsset?: (assetId: string) => void
}
