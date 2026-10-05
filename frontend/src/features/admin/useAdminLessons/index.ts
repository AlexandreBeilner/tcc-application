import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { getAdminLessons, setLessonPublished } from '../../../services/admin'
import type { AdminLesson, LessonPublicationResult } from '../../../services/admin'
import { useAuth } from '../../auth/AuthContext'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ADMIN_LESSONS_QUERY_KEY = ['admin', 'lessons'] as const

// O funil só muda com o uso dos usuários e a lista só quando o admin edita: sem polling.
export function useAdminLessonsQuery(): UseQueryResult<AdminLesson[]> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ADMIN_LESSONS_QUERY_KEY,
        queryFn: async () => (await getAdminLessons(token as string)).lessons,
        enabled: token !== null,
        retry: false,
    })
}

export interface SetLessonPublishedVariables {
    id: string
    published: boolean
}

export function useSetLessonPublishedMutation(): UseMutationResult<LessonPublicationResult, unknown, SetLessonPublishedVariables> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, published }: SetLessonPublishedVariables) => setLessonPublished(token as string, id, published),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_LESSONS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
