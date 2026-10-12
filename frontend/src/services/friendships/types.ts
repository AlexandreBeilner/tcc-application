import type { PublicCosmetics } from '../cosmetics'
// Espelha `.docs/backend/friendships.md`.
export type FriendshipStatus = 'pending' | 'accepted'

// Paginação/ordenação de `GET /friendships` e `GET /friendships/requests`
// (6.9.1) — por data (`friendsSince`/`createdAt`), default `desc` no backend.
export type FriendsSortOrder = 'asc' | 'desc'

export interface SearchedUser {
    id: string
    username: string
    name: string
    avatarUrl: string | null
    cosmetics: PublicCosmetics
}

export interface SearchUsersResult {
    users: SearchedUser[]
}

export interface Friendship {
    id: string
    requesterId: string
    addresseeId: string
    status: FriendshipStatus
    createdAt: string
    respondedAt: string | null
}

export interface SendFriendRequestResult {
    friendship: Friendship
}

export interface Friend {
    friendshipId: string
    userId: string
    username: string
    name: string
    avatarUrl: string | null
    cosmetics: PublicCosmetics
    friendsSince: string
}

export interface ListFriendsResult {
    friends: Friend[]
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
}

export interface FriendRequest {
    friendshipId: string
    userId: string
    username: string
    name: string
    avatarUrl: string | null
    cosmetics: PublicCosmetics
    createdAt: string
}

export interface PaginatedFriendRequests {
    items: FriendRequest[]
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
}

export interface ListFriendRequestsResult {
    received: PaginatedFriendRequests
    sent: PaginatedFriendRequests
}
