import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { removeFriendship } from '../../../services/friendships'
import { FRIENDS_QUERY_KEY } from '../useFriendsQuery'
import { FRIEND_REQUESTS_QUERY_KEY } from '../useFriendRequestsQuery'

// `DELETE /friendships/:id` cobre recusar (recebida) e cancelar (enviada)
// na mesma rota — tela 8.3 decide o rótulo do botão, não qual mutation
// chamar (`.docs/backend/friendships.md`).
export function useRemoveFriendshipMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (friendshipId: string) => removeFriendship(token as string, friendshipId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY })
        },
    })
}
