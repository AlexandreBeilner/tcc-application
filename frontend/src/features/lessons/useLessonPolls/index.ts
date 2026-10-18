import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { votePoll } from '../../../services/lessons'
import type { PollState } from '../../../services/lessons'

// Enquetes da comunidade de uma lição (LJ.2.6): o voto que o servidor restaurou (`GET /lessons/:id`) mais o que
// foi votado nesta sessão. Votar não trava nada e vale também em revisão (a enquete pode ter entrado depois de a
// pessoa concluir a lição). O servidor mantém o primeiro voto, então um reenvio devolve o mesmo estado.
export function useLessonPolls(lessonId: string, serverState: PollState[] | undefined) {
    const { token } = useAuth()
    const [local, setLocal] = useState<Record<string, PollState>>({})
    const mutation = useMutation({
        mutationFn: ({ pollId, option }: { pollId: string; option: number }) => votePoll(token as string, lessonId, pollId, option),
    })

    function stateFor(pollId: string): PollState | undefined {
        return local[pollId] ?? serverState?.find((state) => state.pollId === pollId)
    }

    async function vote(pollId: string, option: number) {
        let result
        try {
            result = await mutation.mutateAsync({ pollId, option })
        } catch {
            // Falha de rede: `isError` mostra o aviso e a enquete segue sem voto.
            return
        }
        setLocal((current) => ({ ...current, [pollId]: result.poll }))
    }

    return { stateFor, vote, isPending: mutation.isPending, isError: mutation.isError }
}
