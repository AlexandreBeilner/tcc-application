import type { TrackGroup } from '../../../features/lessons/trackGroups'

export interface TrackCardProps {
    group: TrackGroup
    onClick: () => void
}
