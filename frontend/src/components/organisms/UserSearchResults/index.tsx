import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { resolveFriendshipStatus } from '../../../features/friendships/resolveFriendshipStatus'
import { useRespondToFriendRequestMutation } from '../../../features/friendships/useRespondToFriendRequestMutation'
import { useSendFriendRequestMutation } from '../../../features/friendships/useSendFriendRequestMutation'
import type { UserSearchResultsProps } from './types'
import styles from './index.module.css'

export type { UserSearchResultsProps } from './types'

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

// Tela 8.2 — nem `GET /users/search` devolve o estado da amizade com quem
// busca (`.docs/backend/friendships.md`), então cruza contra as listas de
// amigos/solicitações já buscadas pra tela (`resolveFriendshipStatus`) em
// vez de um endpoint novo. "Adicionar" → `POST /friendships`, sem navegar
// (inventário 8.2) — o próprio botão muda de estado; pedido mútuo
// simultâneo já chega como `friend` depois do refetch (o backend aceita
// automaticamente, `.docs/backend/friendships.md`), sem tela de "pendente"
// intermediária.
export function UserSearchResults({ results, currentUserId, friends, sentRequests, receivedRequests }: UserSearchResultsProps) {
    const navigate = useNavigate()
    const sendRequest = useSendFriendRequestMutation()
    const respondToRequest = useRespondToFriendRequestMutation()

    if (results.length === 0) {
        return <p className={styles.empty}>Nenhum usuário encontrado com esse nome de usuário.</p>
    }

    return (
        <ul className={styles.list}>
            {results.map((user) => {
                const { status, friendshipId } = resolveFriendshipStatus({
                    currentUserId,
                    targetUserId: user.id,
                    friends,
                    sentRequests,
                    receivedRequests,
                })

                return (
                    <li key={user.id} className={styles.row}>
                        <button type="button" className={styles.identity} onClick={() => navigate(`/perfil/${user.id}`)}>
                            <span className={styles.avatar} aria-hidden="true">
                                {initials(user.username)}
                            </span>
                            <span className={styles.info}>
                                <span className={styles.name}>{user.name}</span>
                                <span className={styles.username}>@{user.username}</span>
                            </span>
                        </button>

                        {status === 'friend' && <span className={styles.status}>Amigos</span>}

                        {status === 'pendingSent' && (
                            <span className={styles.status} title="Aguardando a pessoa aceitar">
                                Pendente
                            </span>
                        )}

                        {status === 'pendingReceived' && friendshipId && (
                            <Button
                                variant="secondary"
                                disabled={respondToRequest.isPending && respondToRequest.variables === friendshipId}
                                onClick={() => respondToRequest.mutate(friendshipId)}
                            >
                                Aceitar
                            </Button>
                        )}

                        {status === 'none' && (
                            <Button
                                variant="secondary"
                                disabled={sendRequest.isPending && sendRequest.variables === user.username}
                                onClick={() => sendRequest.mutate(user.username)}
                            >
                                Adicionar
                            </Button>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
