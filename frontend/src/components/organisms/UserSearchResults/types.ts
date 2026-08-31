import type { Friend, FriendRequest, SearchedUser } from '../../../services/friendships'

export interface UserSearchResultsProps {
    results: SearchedUser[]
    currentUserId: string
    friends: Friend[]
    sentRequests: FriendRequest[]
    receivedRequests: FriendRequest[]
}
