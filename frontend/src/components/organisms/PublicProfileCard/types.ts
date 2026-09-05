import type { Friend, FriendRequest } from '../../../services/friendships'
import type { PublicProfile } from '../../../services/profile'

export interface PublicProfileCardProps {
    profile: PublicProfile
    currentUserId: string
    targetUserId: string
    friends: Friend[]
    sentRequests: FriendRequest[]
    receivedRequests: FriendRequest[]
    // Só passado por `MeuPerfil` (9.1, tarefa 6.10.2) — quando presente e
    // `status === 'self'`, mostra o ícone de editar no header em vez do
    // badge "Este é o seu perfil". `PublicProfileCard` continua sem saber
    // pra onde isso navega (8.4 nunca passa esta prop).
    onEdit?: () => void
}
