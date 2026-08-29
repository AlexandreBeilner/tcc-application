import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { simulateFixedIncome } from '../../../services/market'
import type { SimulateFixedIncomeResult } from '../../../services/market'

// `GET /fixed-income/simulate` não tem efeito colateral (backlog 6.0.5) —
// modelado como query, não mutation: refeita sozinha sempre que
// `amount`/`daysHeld` mudam (novo valor no simulador de aporte, tela 4.3),
// mesmo padrão de qualquer outro dado derivado dos parâmetros da tela.
export function useSimulateFixedIncomeQuery(assetId: string, amount: number, daysHeld: number): UseQueryResult<SimulateFixedIncomeResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'fixed-income', 'simulate', assetId, amount, daysHeld] as const,
        queryFn: () => simulateFixedIncome(token as string, { asset_id: assetId, amount, days_held: daysHeld }),
        enabled: token !== null && amount > 0 && daysHeld > 0,
    })
}
