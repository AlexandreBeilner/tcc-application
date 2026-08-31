import type { FriendRequest } from '../../../services/friendships'

export interface FriendRequestsPanelProps {
    received: FriendRequest[]
    sent: FriendRequest[]
    receivedPage: number
    receivedTotalPages: number
    onReceivedPageChange: (page: number) => void
    sentPage: number
    sentTotalPages: number
    onSentPageChange: (page: number) => void
}
