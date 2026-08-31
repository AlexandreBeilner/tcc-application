import type { Friend, FriendRequest } from '../../../services/friendships'
import type { FriendshipStatusWithUser } from './types'

export type { FriendshipStatusWithUser } from './types'

export interface ResolveFriendshipStatusInput {
    currentUserId: string
    targetUserId: string
    friends: Friend[]
    sentRequests: FriendRequest[]
    receivedRequests: FriendRequest[]
}

export interface ResolvedFriendshipStatus {
    status: FriendshipStatusWithUser
    // `id` da linha `friendships` pendente, só quando `status` é
    // `pendingSent`/`pendingReceived` — sustenta "Cancelar"/"Aceitar" sem
    // buscar de novo.
    friendshipId: string | null
}

// Nem `GET /users/search` nem `GET /users/:id/profile` devolvem o estado
// da amizade com quem busca/vê (`.docs/backend/friendships.md`,
// `.docs/backend/profile.md`) — cruzar contra `GET /friendships` +
// `GET /friendships/requests` (já buscados em outros pontos da tela, sem
// endpoint novo) é o que sustenta o botão "Adicionar"/"Pendente"/"Aceitar"
// nas telas 8.2/8.4. `pendingReceived` cobre o "pedido mútuo simultâneo"
// (estados especiais da 6.9): a pessoa já te pediu, então o botão certo é
// "Aceitar", não "Adicionar" de novo.
export function resolveFriendshipStatus({
    currentUserId,
    targetUserId,
    friends,
    sentRequests,
    receivedRequests,
}: ResolveFriendshipStatusInput): ResolvedFriendshipStatus {
    if (targetUserId === currentUserId) {
        return { status: 'self', friendshipId: null }
    }

    if (friends.some((friend) => friend.userId === targetUserId)) {
        return { status: 'friend', friendshipId: null }
    }

    const received = receivedRequests.find((request) => request.userId === targetUserId)
    if (received) {
        return { status: 'pendingReceived', friendshipId: received.friendshipId }
    }

    const sent = sentRequests.find((request) => request.userId === targetUserId)
    if (sent) {
        return { status: 'pendingSent', friendshipId: sent.friendshipId }
    }

    return { status: 'none', friendshipId: null }
}
