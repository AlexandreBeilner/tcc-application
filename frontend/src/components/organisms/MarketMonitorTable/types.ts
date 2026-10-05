import type { MonitorSortDirection, MonitorSortKey } from '../../../features/admin/marketMonitor'
import type { MonitorAsset } from '../../../services/admin'

export interface MarketMonitorTableProps {
    assets: MonitorAsset[]
    sortKey: MonitorSortKey
    sortDirection: MonitorSortDirection
    onSort: (key: MonitorSortKey) => void
    emptyMessage: string
}
