import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getReviewSession } from '../../../services/lessons'
import type { ReviewSession } from '../../../services/lessons'

export const REVIEW_SESSION_QUERY_KEY = ['lessons', 'review-session'] as const

// Revisão de 1 minuto (LJ.5.6): o hub só mostra o cartão com `ready`. Sem refetch ao voltar o foco, senão as
// perguntas trocariam no meio da revisão.
export function useReviewSession(): UseQueryResult<ReviewSession> {
    const { token } = useAuth()

    return useQuery({
        queryKey: REVIEW_SESSION_QUERY_KEY,
        queryFn: () => getReviewSession(token as string),
        enabled: token !== null,
        refetchOnWindowFocus: false,
    })
}
