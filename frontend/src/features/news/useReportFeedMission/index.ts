import { useMissionsQuery } from '../../missions/useMissionsQuery'
import { useCompleteMissionMutation } from '../../missions/useCompleteMissionMutation'

// "Consulte o feed de notícias" (`backend/src/db/seedMissions.ts`) é uma
// das duas missões sem verificação cruzada real — auto-reportada pelo
// cliente quando o usuário efetivamente lê um evento no Feed, não só
// visita a rota (decisão cross-tarefa documentada no backlog, 6.8: "a
// tela de Calculadora e o Feed precisam disparar POST /missions/:id/
// complete quando o usuário efetivamente usa essas telas"). Casamento por
// título é o único identificador estável que `GET /missions` expõe hoje —
// se o texto do seed mudar, este casamento para de funcionar (fragilidade
// aceita por ora, mesma classe de decisão de `unreadNews`).
const FEED_MISSION_TITLE = 'Consulte o feed de notícias'

export function useReportFeedMission(): () => void {
    const missionsQuery = useMissionsQuery()
    const completeMission = useCompleteMissionMutation()

    return function reportFeedRead(): void {
        const mission = missionsQuery.data?.missions.find((m) => m.title === FEED_MISSION_TITLE)
        if (mission && mission.status === 'pending' && !completeMission.isPending) {
            completeMission.mutate(mission.id)
        }
    }
}
