import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { placeOrder } from '../../../services/market'
import type { PlaceOrderInput, PlaceOrderResult } from '../../../services/market'
import { MY_ACCOUNT_QUERY_KEY } from '../../portfolio/useMyAccountQuery'
import { MY_EVENTS_QUERY_KEY } from '../useMyEventsQuery'

// Tela 4.7 (Confirmação de Ordem), execução real de renda variável —
// invalida conta e extrato do próprio usuário, os dois únicos dados que
// mudam de verdade com uma ordem preenchida (`.docs/backend/market.md`).
export function usePlaceOrderMutation(): UseMutationResult<PlaceOrderResult, unknown, PlaceOrderInput> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: PlaceOrderInput) => placeOrder(token as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_ACCOUNT_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MY_EVENTS_QUERY_KEY })
        },
    })
}
