import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { useRewardReveal } from '../../shell/RewardRevealProvider'
import { dispatchRewardReveals } from '../../shell/dispatchRewardReveals'
import { advanceLesson } from '../../../services/lessons'
import type { AdvanceLessonResult } from '../../../services/lessons'
import { LESSONS_QUERY_KEY } from '../useLessonsQuery'
import { lessonQueryKey } from '../useLessonQuery'

// A escolha da Micro-decisão não viaja mais aqui (RC.2.3: `useAnswerMicroDecision`).
export interface AdvanceLessonVariables {
    step: number
}

// `POST /lessons/:id/progress` (`.docs/backend/lessons.md`) — o backend já
// credita xp/streak sozinho ao alcançar o step 3 pela primeira vez, essa
// mutation grava `step`, invalida as duas queries que dependem do resultado
// (a lição em si e o mapa, cujo `status`/`currentStep` mudam) e, se a
// resposta trouxer `xpAwarded`/`leveledUp` (só na conclusão de fato, nunca
// ao reabrir uma lição já concluída), dispara o "teatro de recompensa"
// (backlog engajamento I.3); cada item de `unlockedAchievements` dispara o
// próprio reveal, na fila logo depois do de XP/nível (I.4); `streakMilestone`
// (7 ou 30 dias) dispara o reveal de marco de streak, por último (I.5).
export interface UseAdvanceLessonOptions {
    // O XP da conclusão aparece na própria tela final da lição (LJ.1.4), então o aviso global de "+N XP" não
    // dispara por cima dele. Nível, conquistas e marco de streak seguem pelo aviso global.
    inlineXp?: boolean
}

export function useAdvanceLesson(
    lessonId: string,
    { inlineXp = false }: UseAdvanceLessonOptions = {},
): UseMutationResult<AdvanceLessonResult, unknown, AdvanceLessonVariables> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    const { show } = useRewardReveal()

    return useMutation({
        mutationFn: ({ step }: AdvanceLessonVariables) => advanceLesson(token as string, lessonId, step),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: lessonQueryKey(lessonId) })
            queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
            dispatchRewardReveals(show, inlineXp && !data.leveledUp ? { ...data, xpAwarded: undefined } : data)
        },
    })
}
