import type { DailyMission } from '../../../services/missions'

export interface DailyMissionsListProps {
    missions: DailyMission[]
    streak: number
}
