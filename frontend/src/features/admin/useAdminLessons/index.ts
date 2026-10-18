import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import {
    createAdminLesson,
    getAdminLesson,
    getAdminLessons,
    getLessonCardFunnel,
    getLessonRevision,
    restoreLessonRevision,
    setLessonPublished,
    updateAdminLesson,
} from '../../../services/admin'
import type {
    AdminLesson,
    AdminLessonContent,
    AdminLessonForEdit,
    LessonCardFunnel,
    LessonCreateInput,
    LessonCreateResult,
    LessonPublicationResult,
    LessonRevisionContent,
    LessonSaveResult,
} from '../../../services/admin'
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

export const adminLessonQueryKey = (id: string) => ['admin', 'lessons', 'detail', id] as const

export function useAdminLessonQuery(id: string): UseQueryResult<AdminLessonForEdit> {
    const { token } = useAuth()
    return useQuery({
        queryKey: adminLessonQueryKey(id),
        queryFn: () => getAdminLesson(token as string, id),
        enabled: token !== null,
        retry: false,
    })
}

// Retrato de uma revisão (só carrega quando o admin abre uma).
export function useLessonRevisionQuery(lessonId: string, revisionId: string | null): UseQueryResult<LessonRevisionContent> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ['admin', 'lessons', 'revision', lessonId, revisionId] as const,
        queryFn: () => getLessonRevision(token as string, lessonId, revisionId as string),
        enabled: token !== null && revisionId !== null,
        retry: false,
    })
}

function useInvalidateLessons() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_LESSONS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useUpdateLessonMutation(id: string): UseMutationResult<LessonSaveResult, unknown, AdminLessonContent> {
    const { token } = useAuth()
    const invalidate = useInvalidateLessons()
    return useMutation({
        mutationFn: (content: AdminLessonContent) => updateAdminLesson(token as string, id, content),
        onSettled: invalidate,
    })
}

export function useCreateLessonMutation(): UseMutationResult<LessonCreateResult, unknown, LessonCreateInput> {
    const { token } = useAuth()
    const invalidate = useInvalidateLessons()
    return useMutation({
        mutationFn: (input: LessonCreateInput) => createAdminLesson(token as string, input),
        onSettled: invalidate,
    })
}

export function useRestoreLessonRevisionMutation(lessonId: string): UseMutationResult<LessonSaveResult, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidateLessons()
    return useMutation({
        mutationFn: (revisionId: string) => restoreLessonRevision(token as string, lessonId, revisionId),
        onSettled: invalidate,
    })
}

// Funil por cartão (LJ.5.1). Dado de uso, não muda sozinho: sem polling.
export function useLessonCardFunnelQuery(id: string, days: number): UseQueryResult<LessonCardFunnel> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ['admin', 'lessons', 'card-funnel', id, days] as const,
        queryFn: () => getLessonCardFunnel(token as string, id, days),
        enabled: token !== null,
        retry: false,
    })
}
