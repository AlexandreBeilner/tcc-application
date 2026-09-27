import type { SimulateFixedIncomeResult } from '../../../services/market'

export interface FixedIncomeSimulatorProps {
    minimumInvestment: number
    amount: number
    onAmountChange: (amount: number) => void
    simulation?: SimulateFixedIncomeResult
    onInvest: () => void
    // Motivo em texto de o aporte estar bloqueado agora (mercado fechado, tarefa S.11); desabilita o botão.
    closedReason?: string | null
}
