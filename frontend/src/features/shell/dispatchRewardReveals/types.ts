import type { AchievementRewardSource } from '../achievementRewardReveal/types'
import type { StreakRewardSource } from '../streakRewardReveal/types'
import type { XpRewardSource } from '../xpRewardReveal/types'

// União dos 3 recortes mínimos (I.3-I.5) — o mesmo `result` de mutação
// (`AdvanceLessonResult`/`CompleteMissionResult`) sempre satisfaz os três.
export interface RewardRevealSource
    extends XpRewardSource,
        AchievementRewardSource,
        StreakRewardSource {}
