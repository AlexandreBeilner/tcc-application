import { Flame } from 'lucide-react'
import type { RewardRevealContent } from '../RewardRevealProvider'
import type { StreakRewardSource } from './types'

export type { StreakRewardSource } from './types'

// Tarefa I.5: reveal do marco de streak (`streakMilestone`, I.2) — `7` ou
// `30`, os únicos marcos com achievement seedado (`seedAchievements.ts`,
// nunca `14`). `null`/ausente (dia sem marco batido) não mostra nada.
// `Flame` é o mesmo ícone já usado pro streak em `ProgressionSummary`/
// `PublicProfileCard`/`DailyMissionsList` — mesma disciplina de ícone
// reaproveitado por conceito que a I.3/I.4 já seguiram (Sparkles/
// TrendingUp/Award, cada um com um único significado no app).
export function streakRevealContent(result: StreakRewardSource): RewardRevealContent | null {
    if (!result.streakMilestone) {
        return null
    }
    return {
        icon: <Flame size={22} strokeWidth={2.2} fill="currentColor" />,
        title: `${result.streakMilestone} dias seguidos!`,
    }
}
