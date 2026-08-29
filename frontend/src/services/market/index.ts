import { apiRequest } from '../client'
import type { MyAccount } from './types'

export type { MyAccountPosition, MyAccountFixedIncomePosition, MyAccount } from './types'

export function getMyAccount(token: string): Promise<MyAccount> {
    return apiRequest<MyAccount>('/market/me/account', { token })
}
