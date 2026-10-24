import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { recordReviewResult } from '../../../services/lessons'
import { REVIEW_SESSION_QUERY_KEY } from '../useReviewSession'

interface RecallResult {
    lessonId: string
    checkpointId: string
    correct: boolean
}

// "Relembra?" (LJ.5.5) conta como revisão (LJ.5.6): acertar de primeira adia a volta da pergunta errada,
// errar a traz de volta logo. O servidor só grava se a pergunta estiver vencida na fila; nas outras, é nada.
export function useRecordRecall(): (result: RecallResult) => void {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: ({ lessonId, checkpointId, correct }: RecallResult) =>
            recordReviewResult(token as string, lessonId, checkpointId, correct),
        onSuccess: ({ recorded }) => {
            if (recorded) void queryClient.invalidateQueries({ queryKey: REVIEW_SESSION_QUERY_KEY })
        },
    })

    return (result) => {
        if (token !== null) mutation.mutate(result)
    }
}
