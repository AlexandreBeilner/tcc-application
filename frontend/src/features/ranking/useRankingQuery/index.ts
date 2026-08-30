import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getRanking } from '../../../services/ranking'
import type { RankingCriterion, RankingResult, RankingScope, RankingWindow } from '../../../services/ranking'

// `window`/`scope`/`criterion`/`page` mudam por seleção explícita do
// usuário (Select/toggle/paginação), nunca por digitação — sem debounce,
// mesmo raciocínio de `useFixedIncomeTaxRateQuery` (6.7). `window` é
// ignorado pelo backend quando `criterion === 'level'` (6.8.3), mas ainda
// entra na queryKey — trocar de critério nunca reaproveita cache de outro.
export function useRankingQuery(
    window: RankingWindow,
    scope: RankingScope,
    criterion: RankingCriterion,
    page: number,
): UseQueryResult<RankingResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['ranking', window, scope, criterion, page] as const,
        queryFn: () =>
            getRanking(token as string, {
                window: criterion === 'level' ? undefined : window,
                scope,
                criterion,
                page,
            }),
        enabled: token !== null,
    })
}
