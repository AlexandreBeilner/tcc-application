import { apiRequest } from '../client'
import type {
    Friendship,
    FriendsSortOrder,
    ListFriendRequestsResult,
    ListFriendsResult,
    SearchUsersResult,
    SendFriendRequestResult,
} from './types'

export type {
    Friend,
    FriendRequest,
    Friendship,
    FriendshipStatus,
    FriendsSortOrder,
    ListFriendRequestsResult,
    ListFriendsResult,
    PaginatedFriendRequests,
    SearchedUser,
    SearchUsersResult,
    SendFriendRequestResult,
} from './types'

export function searchUsers(token: string, query: string): Promise<SearchUsersResult> {
    return apiRequest<SearchUsersResult>(`/users/search?q=${encodeURIComponent(query)}`, { token })
}

export function sendFriendRequest(token: string, addresseeUsername: string): Promise<SendFriendRequestResult> {
    return apiRequest<SendFriendRequestResult>('/friendships', { token, method: 'POST', body: { addresseeUsername } })
}

export function acceptFriendRequest(token: string, friendshipId: string): Promise<{ friendship: Friendship }> {
    return apiRequest<{ friendship: Friendship }>(`/friendships/${friendshipId}/accept`, { token, method: 'POST' })
}

// `204` sem corpo — cobre tanto recusar (quando quem chama é o addressee)
// quanto cancelar (quando é o requester), mesma rota única do backend
// (`.docs/backend/friendships.md`).
export function removeFriendship(token: string, friendshipId: string): Promise<void> {
    return apiRequest<void>(`/friendships/${friendshipId}`, { token, method: 'DELETE' })
}

export function listFriends(token: string, page: number, sort: FriendsSortOrder): Promise<ListFriendsResult> {
    const query = new URLSearchParams({ page: String(page), sort })
    return apiRequest<ListFriendsResult>(`/friendships?${query.toString()}`, { token })
}

export function listFriendRequests(
    token: string,
    receivedPage: number,
    sentPage: number,
    sort: FriendsSortOrder,
): Promise<ListFriendRequestsResult> {
    const query = new URLSearchParams({ receivedPage: String(receivedPage), sentPage: String(sentPage), sort })
    return apiRequest<ListFriendRequestsResult>(`/friendships/requests?${query.toString()}`, { token })
}
