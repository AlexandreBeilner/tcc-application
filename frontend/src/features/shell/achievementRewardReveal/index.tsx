import { Award } from 'lucide-react'
import type { RewardRevealContent } from '../RewardRevealProvider'
import type { AchievementRewardSource } from './types'

export type { AchievementRewardSource, UnlockedAchievementSource } from './types'

// Tarefa I.4: 1 reveal por conquista desbloqueada na resposta de uma
// mutação (`useAdvanceLesson`, `useCompleteMissionMutation`) — array vazio
// quando `unlockedAchievements` vem ausente/vazio (nada novo desbloqueado,
// ou reenvio idempotente — `unlockedAchievements` já vem vazio do backend
// nesse caso, sem lógica de dedup necessária aqui). `Award` é o mesmo ícone
// já usado pra conquista em `AchievementsGrid`/`PublicProfileCard` — evita a
// ambiguidade visual que a I.3 já cuidou de evitar pro par XP/level-up.
export function achievementRevealContents(result: AchievementRewardSource): RewardRevealContent[] {
    const achievements = result.unlockedAchievements ?? []
    return achievements.map((achievement) => ({
        icon: <Award size={22} strokeWidth={2.2} />,
        title: achievement.name,
        description: achievement.description ?? undefined,
    }))
}
