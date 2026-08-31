import type { RankingCriterion, RankingEntry, RankingScope } from '../../../services/ranking'

export interface RankingBoardProps {
    entries: RankingEntry[]
    scope: RankingScope
    criterion: RankingCriterion
    currentUserId: string | null
    // Posição (1-based) do usuário autenticado na lista completa, mesmo
    // fora da página exibida — sustenta "você está em Nº" quando o usuário
    // não aparece no pódio nem na página atual.
    requestingUserPosition: number | null
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
    onPageChange: (page: number) => void
}
