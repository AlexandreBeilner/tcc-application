import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { advanceLesson } from '../../../services/lessons'
import type { AdvanceLessonResult } from '../../../services/lessons'
import { LESSONS_QUERY_KEY } from '../useLessonsQuery'
import { lessonQueryKey } from '../useLessonQuery'

// `POST /lessons/:id/progress` (`.docs/backend/lessons.md`) — o backend já
// credita xp/streak sozinho ao alcançar o step 3 pela primeira vez, essa
// mutation só grava `step` e invalida as duas queries que dependem do
// resultado (a lição em si e o mapa, cujo `status`/`currentStep` mudam).
export function useAdvanceLesson(lessonId: string): UseMutationResult<AdvanceLessonResult, unknown, number> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (step: number) => advanceLesson(token as string, lessonId, step),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: lessonQueryKey(lessonId) })
            queryClient.invalidateQueries({ queryKey: LESSONS_QUERY_KEY })
        },
    })
}
