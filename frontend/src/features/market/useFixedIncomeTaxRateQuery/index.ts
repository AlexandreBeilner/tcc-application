import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getFixedIncomeTaxRate } from '../../../services/market'
import type { FixedIncomeTaxRateResult } from '../../../services/market'

// `GET /fixed-income/tax-rate` não tem efeito colateral (tarefa 6.7,
// mesmo raciocínio de `useSimulateFixedIncomeQuery`) — modelado como
// query. Sustenta a Calculadora em modo comparação: `daysHeld` muda pouco
// (campo numérico de prazo, não texto livre digitado tecla a tecla), então
// sem debounce — diferente do valor de aporte do simulador de 4.3.
export function useFixedIncomeTaxRateQuery(daysHeld: number): UseQueryResult<FixedIncomeTaxRateResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'fixed-income', 'tax-rate', daysHeld] as const,
        queryFn: () => getFixedIncomeTaxRate(token as string, daysHeld),
        enabled: token !== null && daysHeld > 0,
    })
}
