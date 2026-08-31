import type { Friend, FriendRequest } from '../../../services/friendships'
import type { PublicProfile } from '../../../services/profile'

export interface PublicProfileCardProps {
    profile: PublicProfile
    currentUserId: string
    targetUserId: string
    friends: Friend[]
    sentRequests: FriendRequest[]
    receivedRequests: FriendRequest[]
}
