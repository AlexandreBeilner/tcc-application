import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import {
    adjustAdminUserXp,
    correctAdminUserAchievement,
    correctAdminUserLesson,
    creditAdminUser,
    getUserCorrectionContext,
    setAdminUserStreak,
} from '../../../services/admin'
import type {
    AchievementCorrection,
    CorrectedProgression,
    CreditUserResult,
    LessonCorrection,
    UserCorrectionContext,
} from '../../../services/admin'
import { useAuth } from '../../auth/AuthContext'
import { useAdminReauth } from '../AdminReauth'
import { ADMIN_USER_DETAIL_QUERY_KEY } from '../useAdminUserDetailQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const USER_CORRECTION_CONTEXT_QUERY_KEY = ['admin', 'user-corrections'] as const

// Conquistas e lições do usuário, pros seletores das correções (N.17).
export function useUserCorrectionContextQuery(userId: string): UseQueryResult<UserCorrectionContext> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...USER_CORRECTION_CONTEXT_QUERY_KEY, userId] as const,
        queryFn: () => getUserCorrectionContext(token as string, userId),
        enabled: token !== null,
        retry: false,
    })
}

// Toda correção muda o detalhe (patrimônio, progressão, linha do tempo), os seletores e a
// auditoria. Invalida no `onSettled`: uma recusa (409, nada a mudar) também deixa a tela velha.
function useInvalidateCorrectionQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_USER_DETAIL_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: USER_CORRECTION_CONTEXT_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export interface CreditUserVariables {
    userId: string
    amount: number
    reason?: string
}

export function useCreditUserMutation(): UseMutationResult<CreditUserResult, unknown, CreditUserVariables> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateCorrectionQueries()
    return useMutation({
        mutationFn: ({ userId, amount, reason }: CreditUserVariables) =>
            withReauth((t) => creditAdminUser(t, userId, { amount, ...(reason ? { reason } : {}) })),
        onSettled: invalidate,
    })
}

export interface AdjustXpVariables {
    userId: string
    delta: number
    reason: string
}

export function useAdjustXpMutation(): UseMutationResult<CorrectedProgression, unknown, AdjustXpVariables> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateCorrectionQueries()
    return useMutation({
        mutationFn: ({ userId, delta, reason }: AdjustXpVariables) => withReauth((t) => adjustAdminUserXp(t, userId, delta, reason)),
        onSettled: invalidate,
    })
}

export interface SetStreakVariables {
    userId: string
    value: number
    reason: string
}

export function useSetStreakMutation(): UseMutationResult<CorrectedProgression, unknown, SetStreakVariables> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateCorrectionQueries()
    return useMutation({
        mutationFn: ({ userId, value, reason }: SetStreakVariables) => withReauth((t) => setAdminUserStreak(t, userId, value, reason)),
        onSettled: invalidate,
    })
}

export interface CorrectAchievementVariables {
    userId: string
    achievementId: string
    action: AchievementCorrection
    reason: string
}

export function useCorrectAchievementMutation(): UseMutationResult<void, unknown, CorrectAchievementVariables> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateCorrectionQueries()
    return useMutation({
        mutationFn: ({ userId, achievementId, action, reason }: CorrectAchievementVariables) =>
            withReauth((t) => correctAdminUserAchievement(t, userId, achievementId, action, reason)),
        onSettled: invalidate,
    })
}

export interface CorrectLessonVariables {
    userId: string
    lessonId: string
    action: LessonCorrection
    reason: string
}

export function useCorrectLessonMutation(): UseMutationResult<void, unknown, CorrectLessonVariables> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateCorrectionQueries()
    return useMutation({
        mutationFn: ({ userId, lessonId, action, reason }: CorrectLessonVariables) =>
            withReauth((t) => correctAdminUserLesson(t, userId, lessonId, action, reason)),
        onSettled: invalidate,
    })
}
