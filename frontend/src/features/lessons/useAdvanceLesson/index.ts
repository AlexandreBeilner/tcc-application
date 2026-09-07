import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { useRewardReveal } from '../../shell/RewardRevealProvider'
import { xpRevealContent } from '../../shell/xpRewardReveal'
import { achievementRevealContents } from '../../shell/achievementRewardReveal'
import { streakRevealContent } from '../../shell/streakRewardReveal'
import { advanceLesson } from '../../../services/lessons'
import type { AdvanceLessonResult } from '../../../services/lessons'
import { LESSONS_QUERY_KEY } from '../useLessonsQuery'
import { lessonQueryKey } from '../useLessonQuery'

// `POST /lessons/:id/progress` (`.docs/backend/lessons.md`) — o backend já
// credita xp/streak sozinho ao alcançar o step 3 pela primeira vez, essa
// mutation grava `step`, invalida as duas queries que dependem do resultado
// (a lição em si e o mapa, cujo `status`/`currentStep` mudam) e, se a
// resposta trouxer `xpAwarded`/`leveledUp` (só na conclusão de fato, nunca
// ao reabrir uma lição já concluída), dispara o "teatro de recompensa"
// (backlog engajamento I.3); cada item de `unlockedAchievements` dispara o
// próprio reveal, na fila logo depois do de XP/nível (I.4); `streakMilestone`
// (7 ou 30 dias) dispara o reveal de marco de streak, por último (I.5).
export function useAdvanceLesson(lessonId: string): UseMutationResult<AdvanceLessonResult, unknown, number> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    const { show } = useRewardReveal()

    return useMutation({
        mutationFn: (step: number) => advanceLesson(token as string, lessonId, step),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: lessonQueryKey(lessonId) })
            queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
            const reveal = xpRevealContent(data)
            if (reveal) show(reveal)
            achievementRevealContents(data).forEach(show)
            const streakReveal = streakRevealContent(data)
            if (streakReveal) show(streakReveal)
        },
    })
}
