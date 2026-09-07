import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { useRewardReveal } from '../../shell/RewardRevealProvider'
import { xpRevealContent } from '../../shell/xpRewardReveal'
import { achievementRevealContents } from '../../shell/achievementRewardReveal'
import { streakRevealContent } from '../../shell/streakRewardReveal'
import { completeMission } from '../../../services/missions'
import type { CompleteMissionResult } from '../../../services/missions'
import { MISSIONS_QUERY_KEY } from '../useMissionsQuery'

// `POST /missions/:id/complete` é idempotente (`.docs/backend/missions.md`)
// — reenviar não credita xp/streak de novo, então esta mutation pode ser
// chamada sem checar `status` antes (a tela de Missões, 6.8, é quem lê o
// resultado invalidado). Usado hoje pela auto-report da tarefa 6.6 (Feed
// de Notícias) e futuramente pela 6.7 (Calculadora) — mesma decisão de
// integração cross-tarefa documentada no backlog (6.8, nota da 6.6/6.7). Se
// a resposta trouxer `xpAwarded`/`leveledUp` (só na conclusão de fato,
// ausente num reenvio idempotente), dispara o "teatro de recompensa"
// (backlog engajamento I.3); cada item de `unlockedAchievements` dispara o
// próprio reveal, na fila logo depois do de XP/nível (I.4); `streakMilestone`
// (7 ou 30 dias) dispara o reveal de marco de streak, por último (I.5).
export function useCompleteMissionMutation(): UseMutationResult<CompleteMissionResult, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    const { show } = useRewardReveal()

    return useMutation({
        mutationFn: (missionId: string) => completeMission(token as string, missionId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: MISSIONS_QUERY_KEY })
            const reveal = xpRevealContent(data)
            if (reveal) show(reveal)
            achievementRevealContents(data).forEach(show)
            const streakReveal = streakRevealContent(data)
            if (streakReveal) show(streakReveal)
        },
    })
}
