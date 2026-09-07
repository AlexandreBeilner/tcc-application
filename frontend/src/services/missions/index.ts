import { apiRequest } from '../client'
import type { CompleteMissionResult, ListMissionsResult } from './types'

export type { DailyMission, ListMissionsResult, CompleteMissionResult, UnlockedAchievement } from './types'

export function listMissions(token: string): Promise<ListMissionsResult> {
    return apiRequest<ListMissionsResult>('/missions', { token })
}

export function completeMission(token: string, missionId: string): Promise<CompleteMissionResult> {
    return apiRequest<CompleteMissionResult>(`/missions/${missionId}/complete`, { token, method: 'POST' })
}
