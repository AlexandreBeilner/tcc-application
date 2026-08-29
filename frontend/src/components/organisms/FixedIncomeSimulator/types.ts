import type { SimulateFixedIncomeResult } from '../../../services/market'

export interface FixedIncomeSimulatorProps {
    minimumInvestment: number
    amount: number
    onAmountChange: (amount: number) => void
    simulation?: SimulateFixedIncomeResult
    onInvest: () => void
}
