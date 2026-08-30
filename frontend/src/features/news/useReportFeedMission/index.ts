import { useCallback, useEffect, useRef } from 'react'
import { useMissionsQuery } from '../../missions/useMissionsQuery'
import { useCompleteMissionMutation } from '../../missions/useCompleteMissionMutation'

// "Consulte o feed de notícias" (`backend/src/db/seedMissions.ts`) é uma
// das duas missões sem verificação cruzada real — auto-reportada pelo
// cliente quando o usuário efetivamente lê um evento no Feed, não só
// visita a rota (decisão cross-tarefa documentada no backlog, 6.8: "a
// tela de Calculadora e o Feed precisam disparar POST /missions/:id/
// complete quando o usuário efetivamente usa essas telas"). Casamento por
// `key` (slug estável, tarefa 6.6.4) — antes era por `title`, que quebrava
// silenciosamente se o texto do seed mudasse.
const FEED_MISSION_KEY = 'feed_read'

export function useReportFeedMission(): () => void {
    const missionsQuery = useMissionsQuery()
    const completeMission = useCompleteMissionMutation()
    // `useNewsFeedQuery`/`useMissionsQuery` disparam em paralelo no mount de
    // News (pages/News) — se o usuário expandir o primeiro evento antes de
    // GET /missions responder, `missionsQuery.data` ainda é undefined e a
    // leitura reportada aqui embaixo se perderia sem retry. `pendingRef`
    // guarda essa intenção e o efeito reexecuta assim que os dados chegarem.
    const pendingRef = useRef(false)

    const completeIfPending = useCallback((): void => {
        const mission = missionsQuery.data?.missions.find((m) => m.key === FEED_MISSION_KEY)
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

    return function reportFeedRead(): void {
        if (!missionsQuery.data) {
            pendingRef.current = true
            return
        }
        completeIfPending()
    }
}
