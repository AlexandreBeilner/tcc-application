import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { sendFriendRequest } from '../../../services/friendships'
import type { SendFriendRequestResult } from '../../../services/friendships'
import { FRIENDS_QUERY_KEY } from '../useFriendsQuery'
import { FRIEND_REQUESTS_QUERY_KEY } from '../useFriendRequestsQuery'

// `POST /friendships` pode devolver `status: accepted` direto (pedido
// mútuo simultâneo — `.docs/backend/friendships.md`) em vez de `pending`,
// então invalida os dois caches (amigos e solicitações) em vez de só
// solicitações: quem chama nunca precisa inspecionar `friendship.status`
// pra saber qual lista vai mudar.
export function useSendFriendRequestMutation(): UseMutationResult<SendFriendRequestResult, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (addresseeUsername: string) => sendFriendRequest(token as string, addresseeUsername),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY })
        },
    })
}
