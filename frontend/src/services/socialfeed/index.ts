import { apiRequest } from '../client'
import type { GetSocialFeedResult } from './types'

export type { GetSocialFeedResult, SocialFeedEvent } from './types'

export function getSocialFeed(token: string): Promise<GetSocialFeedResult> {
    return apiRequest<GetSocialFeedResult>('/social-feed', { token })
}
