import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { answerMicroDecision } from '../../../services/lessons'
import type { AnswerMicroDecisionResult } from '../../../services/lessons'
import { lessonQueryKey } from '../useLessonQuery'

// `POST /lessons/:id/answer` (RC.2.3/RC.2.4): uma tentativa da pergunta da
// Micro-decisão. Só o acerto invalida a lição (o `GET` passa a devolver
// `microDecisionSolved`); o erro não muda nada que a tela já não saiba.
export function useAnswerMicroDecision(lessonId: string): UseMutationResult<AnswerMicroDecisionResult, unknown, number> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (selectedOption: number) => answerMicroDecision(token as string, lessonId, selectedOption),
        onSuccess: (data) => {
            if (data.correct) {
                queryClient.invalidateQueries({ queryKey: lessonQueryKey(lessonId) })
            }
        },
    })
}
