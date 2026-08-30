import type { RankingCriterion, RankingEntry, RankingScope } from '../../../services/ranking'

export interface RankingBoardProps {
    entries: RankingEntry[]
    scope: RankingScope
    criterion: RankingCriterion
    currentUserId: string | null
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
    onPageChange: (page: number) => void
}
