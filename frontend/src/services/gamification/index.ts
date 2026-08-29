import { apiRequest } from '../client'
import type { Progression, Streak } from './types'

export type { Progression, Streak } from './types'

export function getProgression(token: string): Promise<Progression> {
    return apiRequest<Progression>('/me/progression', { token })
}

export function getStreak(token: string): Promise<Streak> {
    return apiRequest<Streak>('/me/streak', { token })
}
