import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { acceptFriendRequest } from '../../../services/friendships'
import type { Friendship } from '../../../services/friendships'
import { FRIENDS_QUERY_KEY } from '../useFriendsQuery'
import { FRIEND_REQUESTS_QUERY_KEY } from '../useFriendRequestsQuery'

// Tela 8.3, "Aceitar" — move o par pra amigos confirmados (8.1) e some da
// lista de solicitações recebidas.
export function useRespondToFriendRequestMutation(): UseMutationResult<{ friendship: Friendship }, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (friendshipId: string) => acceptFriendRequest(token as string, friendshipId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY })
        },
    })
}
