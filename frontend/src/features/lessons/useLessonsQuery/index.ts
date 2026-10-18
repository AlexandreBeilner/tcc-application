import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listLessons } from '../../../services/lessons'
import type { ListLessonsResult } from '../../../services/lessons'

export const LESSONS_QUERY_KEY = ['lessons'] as const

// `enabled: false` deixa quem só às vezes precisa da lista (o Perfil, só no próprio) fora da requisição.
export function useLessonsQuery(options: { enabled?: boolean } = {}): UseQueryResult<ListLessonsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: LESSONS_QUERY_KEY,
        queryFn: () => listLessons(token as string),
        enabled: token !== null && options.enabled !== false,
    })
}
