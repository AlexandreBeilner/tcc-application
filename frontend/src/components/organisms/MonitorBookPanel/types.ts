import type { MonitorBookLevel, MonitorTrade } from '../../../services/admin'

export interface MonitorBookPanelProps {
    // Vendas do menor pro maior preço; compras do maior pro menor.
    asks: MonitorBookLevel[]
    bids: MonitorBookLevel[]
    trades: MonitorTrade[]
}
