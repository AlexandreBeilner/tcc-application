import { apiRequest } from '../client'
import type { GetUserProfileParams, PublicProfile } from './types'

export type { GetUserProfileParams, PublicProfile, PublicProfileAchievement } from './types'

export function getUserProfile(token: string, userId: string, params: GetUserProfileParams = {}): Promise<{ profile: PublicProfile }> {
    const query = params.window ? `?window=${params.window}` : ''
    return apiRequest<{ profile: PublicProfile }>(`/users/${userId}/profile${query}`, { token })
}
