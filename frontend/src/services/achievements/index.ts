import { apiRequest } from '../client'
import type { ListAchievementsResult } from './types'

export type { Achievement, AchievementCriteriaType, ListAchievementsResult } from './types'

export function listAchievements(token: string): Promise<ListAchievementsResult> {
    return apiRequest<ListAchievementsResult>('/achievements', { token })
}
