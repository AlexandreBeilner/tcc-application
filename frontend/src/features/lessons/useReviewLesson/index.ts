import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { reviewLesson } from '../../../services/lessons'
import type { ReviewLessonResult } from '../../../services/lessons'

// `POST /lessons/:id/review` (`.docs/backend/lessons.md`, backlog
// engajamento H.2) — só sustenta a missão "revise uma lição antiga" com
// verificação cruzada de verdade, nunca credita xp/streak nem muda
// `status`/`currentStep`; por isso não invalida nenhuma query (diferente de
// `useAdvanceLesson`). `Lesson/index.tsx` chama isso ao reabrir uma lição
// já concluída (modo revisão) — mesmo padrão fire-and-forget de
// `useMarkNewsEventSeenMutation`.
export function useReviewLesson(lessonId: string): UseMutationResult<ReviewLessonResult, unknown, void> {
    const { token } = useAuth()

    return useMutation({
        mutationFn: () => reviewLesson(token as string, lessonId),
    })
}
