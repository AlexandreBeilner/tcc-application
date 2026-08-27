import { apiRequest } from './client'

// Espelha `.docs/backend/gamification.md`.
export interface Progression {
  userId: string
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  lastQualifyingActivityDate: string | null
}

export interface Streak {
  currentStreak: number
  longestStreak: number
}

export function getProgression(token: string): Promise<Progression> {
  return apiRequest<Progression>('/me/progression', { token })
}

export function getStreak(token: string): Promise<Streak> {
  return apiRequest<Streak>('/me/streak', { token })
}
