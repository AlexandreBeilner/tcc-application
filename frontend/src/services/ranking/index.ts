import { apiRequest } from '../client'
import type { GetRankingParams, RankingResult } from './types'

export type { RankingEntry, RankingResult, GetRankingParams, RankingWindow, RankingScope, RankingCriterion } from './types'

export function getRanking(token: string, params: GetRankingParams): Promise<RankingResult> {
    const query = new URLSearchParams({ scope: params.scope, criterion: params.criterion, page: String(params.page) })
    // `window` é omitido pro critério `level` — o backend nem aceita o
    // parâmetro nesse caso (schemas.ts só exige `window` pros outros 3).
    if (params.window) query.set('window', params.window)
    return apiRequest<RankingResult>(`/ranking?${query.toString()}`, { token })
}
