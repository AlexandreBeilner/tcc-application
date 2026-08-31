// Espelha `.docs/backend/friendships.md`.
export type FriendshipStatus = 'pending' | 'accepted'

export interface SearchedUser {
    id: string
    username: string
    name: string
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
    userId: string
    username: string
    name: string
    friendsSince: string
}

export interface ListFriendsResult {
    friends: Friend[]
}

export interface FriendRequest {
    friendshipId: string
    userId: string
    username: string
    name: string
    createdAt: string
}

export interface ListFriendRequestsResult {
    received: FriendRequest[]
    sent: FriendRequest[]
}
