import type { Friend } from '../../../services/friendships'

export interface FriendsListProps {
    friends: Friend[]
    page: number
    totalPages: number
    onPageChange: (page: number) => void
}
