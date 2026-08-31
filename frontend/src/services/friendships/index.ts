import { apiRequest } from '../client'
import type { Friendship, ListFriendRequestsResult, ListFriendsResult, SearchUsersResult, SendFriendRequestResult } from './types'

export type {
    Friend,
    FriendRequest,
    Friendship,
    FriendshipStatus,
    ListFriendRequestsResult,
    ListFriendsResult,
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

export function listFriends(token: string): Promise<ListFriendsResult> {
    return apiRequest<ListFriendsResult>('/friendships', { token })
}

export function listFriendRequests(token: string): Promise<ListFriendRequestsResult> {
    return apiRequest<ListFriendRequestsResult>('/friendships/requests', { token })
}
