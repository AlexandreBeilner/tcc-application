import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { simulateFixedIncome } from '../../../services/market'
import type { SimulateFixedIncomeResult } from '../../../services/market'

const DEBOUNCE_MS = 300

// `GET /fixed-income/simulate` não tem efeito colateral (backlog 6.0.5) —
// modelado como query, não mutation: refeita sozinha sempre que
// `amount`/`daysHeld` mudam (novo valor no simulador de aporte, tela 4.3),
// mesmo padrão de qualquer outro dado derivado dos parâmetros da tela.
// `amount` muda a cada tecla digitada no simulador — debounce evita uma
// requisição por dígito.
export function useSimulateFixedIncomeQuery(assetId: string, amount: number, daysHeld: number): UseQueryResult<SimulateFixedIncomeResult> {
    const { token } = useAuth()
    const [debouncedAmount, setDebouncedAmount] = useState(amount)

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedAmount(amount), DEBOUNCE_MS)
        return () => clearTimeout(timeout)
    }, [amount])

    return useQuery({
        queryKey: ['market', 'fixed-income', 'simulate', assetId, debouncedAmount, daysHeld] as const,
        queryFn: () => simulateFixedIncome(token as string, { asset_id: assetId, amount: debouncedAmount, days_held: daysHeld }),
        enabled: token !== null && debouncedAmount > 0 && daysHeld > 0,
    })
}
