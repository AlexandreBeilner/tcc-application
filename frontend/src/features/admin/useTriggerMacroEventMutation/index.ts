import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { triggerMacroEvent } from '../../../services/admin'
import type { TriggerMacroEventInput, TriggerMacroEventResult } from '../../../services/admin'
import { MACRO_EVENTS_QUERY_KEY } from '../useMacroEventsQuery'

// Tela 10.2 — invalida o histórico (10.1) pro evento recém-disparado
// aparecer no topo assim que a tela voltar pra lá, sem depender de
// refetch manual.
export function useTriggerMacroEventMutation(): UseMutationResult<TriggerMacroEventResult, unknown, TriggerMacroEventInput> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: TriggerMacroEventInput) => triggerMacroEvent(token as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MACRO_EVENTS_QUERY_KEY })
        },
    })
}
