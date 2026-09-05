import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriends } from '../../../services/friendships'
import type { Friend } from '../../../services/friendships'
import { fetchAllPages } from '../../../utils/fetchAllPages'
import { FRIENDS_QUERY_KEY } from '../useFriendsQuery'

export const ALL_FRIENDS_QUERY_KEY = [...FRIENDS_QUERY_KEY, 'all'] as const

// `resolveFriendshipStatus` (8.2/8.4) precisa saber se um usuário
// específico já é amigo — checagem de pertencimento, não a página exibida
// no hub (isso é 8.1, `useFriendsQuery`, paginado desde a 6.9.1). Busca
// todas as páginas em sequência e junta num array só: correto pro volume
// de amigos deste protótipo, sem exigir um endpoint novo só pra essa
// checagem. Chave começa com `FRIENDS_QUERY_KEY` de propósito — mutations
// que já invalidam esse prefixo (enviar/aceitar/desfazer) invalidam esta
// variante junto, sem precisar listar mais uma chave em cada mutation.
export function useAllFriendsQuery(): UseQueryResult<Friend[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ALL_FRIENDS_QUERY_KEY,
        queryFn: async () => {
            const first = await listFriends(token as string, 1, 'desc')
            return fetchAllPages(first.totalPages, first.friends, async (page) => {
                const result = await listFriends(token as string, page, 'desc')
                return result.friends
            })
        },
        enabled: token !== null,
    })
}
