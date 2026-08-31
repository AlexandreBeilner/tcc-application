import type { FriendRequest } from '../../../services/friendships'

export interface FriendRequestsPanelProps {
    received: FriendRequest[]
    sent: FriendRequest[]
}
