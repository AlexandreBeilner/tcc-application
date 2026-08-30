import { useCallback, useEffect, useRef } from 'react'
import { useMissionsQuery } from '../../missions/useMissionsQuery'
import { useCompleteMissionMutation } from '../../missions/useCompleteMissionMutation'

// "Compare dois produtos de renda fixa na calculadora" (`backend/src/db/
// seedMissions.ts`, key `calculator_compare`) — a outra missão sem
// verificação cruzada real (backlog 6.8/6.6: "a tela de Calculadora e o
// Feed precisam disparar POST /missions/:id/complete quando o usuário
// efetivamente usa essas telas"). Mesmo padrão de
// `features/news/useReportFeedMission`: casamento por `key` (tarefa 6.6.4,
// estável mesmo se o `title` do seed mudar) + retry via `pendingRef`
// quando `GET /missions` ainda não respondeu no momento em que o usuário
// já produziu uma comparação válida.
const CALCULATOR_COMPARE_MISSION_KEY = 'calculator_compare'

export function useReportCalculatorComparisonMission(): () => void {
    const missionsQuery = useMissionsQuery()
    const completeMission = useCompleteMissionMutation()
    const pendingRef = useRef(false)

    const completeIfPending = useCallback((): void => {
        const mission = missionsQuery.data?.missions.find((m) => m.key === CALCULATOR_COMPARE_MISSION_KEY)
        if (mission && mission.status === 'pending' && !completeMission.isPending) {
            completeMission.mutate(mission.id)
        }
    }, [missionsQuery.data, completeMission])

    useEffect(() => {
        if (pendingRef.current && missionsQuery.data) {
            pendingRef.current = false
            completeIfPending()
        }
    }, [missionsQuery.data, completeIfPending])

    return function reportComparison(): void {
        if (!missionsQuery.data) {
            pendingRef.current = true
            return
        }
        completeIfPending()
    }
}
