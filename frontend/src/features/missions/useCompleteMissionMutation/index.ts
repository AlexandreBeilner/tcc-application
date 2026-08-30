import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { completeMission } from '../../../services/missions'
import type { CompleteMissionResult } from '../../../services/missions'
import { MISSIONS_QUERY_KEY } from '../useMissionsQuery'

// `POST /missions/:id/complete` é idempotente (`.docs/backend/missions.md`)
// — reenviar não credita xp/streak de novo, então esta mutation pode ser
// chamada sem checar `status` antes (a tela de Missões, 6.8, é quem lê o
// resultado invalidado). Usado hoje pela auto-report da tarefa 6.6 (Feed
// de Notícias) e futuramente pela 6.7 (Calculadora) — mesma decisão de
// integração cross-tarefa documentada no backlog (6.8, nota da 6.6/6.7).
export function useCompleteMissionMutation(): UseMutationResult<CompleteMissionResult, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (missionId: string) => completeMission(token as string, missionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MISSIONS_QUERY_KEY })
        },
    })
}
