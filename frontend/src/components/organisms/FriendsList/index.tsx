import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import type { FriendsListProps } from './types'
import styles from './index.module.css'

export type { FriendsListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

// Tela 8.1 (hub) — estado vazio (inventário: "sem amigos ainda, CTA pra
// buscar") vai direto pra 8.2 (`/amigos/buscar`), não pro próprio hub.
// Clique num amigo → 8.4 (`/perfil/:id`). Sem rentabilidade por card:
// `GET /friendships` (`.docs/backend/friendships.md`) não devolve esse
// dado — quem quiser comparar rentabilidade entra no perfil (8.4) ou usa a
// Classificação com escopo Amigos (7.1), que já é a fonte real desse
// número (RF19).
export function FriendsList({ friends }: FriendsListProps) {
    const navigate = useNavigate()

    if (friends.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p className={styles.emptyBody}>Você ainda não tem amigos por aqui. Busque por username pra adicionar o primeiro.</p>
                <Button variant="secondary" onClick={() => navigate('/amigos/buscar')}>
                    Buscar amigos
                </Button>
            </div>
        )
    }

    return (
        <ul className={styles.list}>
            {friends.map((friend) => (
                <li key={friend.userId}>
                    <button type="button" className={styles.row} onClick={() => navigate(`/perfil/${friend.userId}`)}>
                        <span className={styles.avatar} aria-hidden="true">
                            {initials(friend.username)}
                        </span>
                        <span className={styles.info}>
                            <span className={styles.name}>{friend.name}</span>
                            <span className={styles.username}>@{friend.username}</span>
                        </span>
                        <span className={styles.since}>Amigos desde {dateFormatter.format(new Date(friend.friendsSince))}</span>
                    </button>
                </li>
            ))}
        </ul>
    )
}
