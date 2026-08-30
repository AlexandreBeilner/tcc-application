import type { UseMutationResult } from '@tanstack/react-query'
import { redeemFixedIncome } from '../../../services/market'
import type { RedeemFixedIncomeInput, RedeemFixedIncomeResult } from '../../../services/market'
import { useMarketMutation } from '../useMarketMutation'

export function useRedeemFixedIncomeMutation(): UseMutationResult<RedeemFixedIncomeResult, unknown, RedeemFixedIncomeInput> {
    return useMarketMutation(redeemFixedIncome)
}
