import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFriendRequestsQuery } from '../../../features/friendships/useFriendRequestsQuery'
import styles from './index.module.css'

// Tarefa 6.9.4 — ponto de entrada de Amigos (8.1) na `TopBar`, ao lado do
// sino de notícias (`NewsBell`, precedente visual direto: ícone + link +
// badge). Mantido junto do item "Amigos" no `AvatarMenu` (6.1) — o pedido
// do autor foi "não *só* dentro do menu do usuário", não proibir os dois
// pontos de entrada ao mesmo tempo. Badge numérico (não só um ponto como
// o do `NewsBell`) porque o hub (8.1) já mostra essa mesma contagem
// ("Solicitações (N)") — página 1 de cada lista é o bastante aqui, só o
// `totalEntries` de recebidas importa pro contador.
export function FriendsBell() {
    const requestsQuery = useFriendRequestsQuery(1, 1, 'desc')
    const pendingCount = requestsQuery.data?.received.totalEntries ?? 0

    return (
        <Link to="/amigos" className={styles.bell} aria-label="Amigos">
            <Users size={20} strokeWidth={1.6} aria-hidden="true" />
            {pendingCount > 0 && (
                <span
                    className={styles.badge}
                    aria-label={`${pendingCount} solicitação${pendingCount === 1 ? '' : 'ões'} de amizade pendente${pendingCount === 1 ? '' : 's'}`}
                >
                    {pendingCount}
                </span>
            )}
        </Link>
    )
}
