import type { Movement } from '../../../features/market/movements'

export interface RecentMovementsProps {
    movements: Movement[]
    isLoading: boolean
    isError: boolean
    now: Date
}
