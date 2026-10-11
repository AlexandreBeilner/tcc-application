import { apiRequest } from '../client'
import type { MyReferral } from './types'

export type { MyReferral, ReferralMilestone } from './types'

export function getMyReferral(token: string): Promise<MyReferral> {
    return apiRequest<MyReferral>('/me/referral', { token })
}
