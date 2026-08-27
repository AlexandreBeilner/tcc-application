import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getStreak } from '../api/gamification'
import type { Streak } from '../api/gamification'

export const STREAK_QUERY_KEY = ['gamification', 'me', 'streak'] as const

export function useStreakQuery(): UseQueryResult<Streak> {
  const { token } = useAuth()

  return useQuery({
    queryKey: STREAK_QUERY_KEY,
    queryFn: () => getStreak(token as string),
    enabled: token !== null,
  })
}
