import type { UseMutationResult } from '@tanstack/react-query'
import { placeOrder } from '../../../services/market'
import type { PlaceOrderInput, PlaceOrderResult } from '../../../services/market'
import { useMarketMutation } from '../useMarketMutation'

// Tela 4.7 (Confirmação de Ordem), execução real de renda variável.
export function usePlaceOrderMutation(): UseMutationResult<PlaceOrderResult, unknown, PlaceOrderInput> {
    return useMarketMutation(placeOrder)
}
