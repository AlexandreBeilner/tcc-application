import { useNavigate } from 'react-router-dom'
import { useRemoveFriendshipMutation } from '../../../features/friendships/useRemoveFriendshipMutation'
import { useRespondToFriendRequestMutation } from '../../../features/friendships/useRespondToFriendRequestMutation'
import { Button } from '../../atoms/Button'
import { Pagination } from '../../molecules/Pagination'
import type { FriendRequestsPanelProps } from './types'
import styles from './index.module.css'

export type { FriendRequestsPanelProps } from './types'

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

// Tela 8.3 — duas listas independentes sobre a mesma rota `DELETE
// /friendships/:id` (`.docs/backend/friendships.md`): "Recusar" (recebida)
// e "Cancelar" (enviada) são só rótulos diferentes pro mesmo
// `removeFriendship`, a autorização de quem pode fazer o quê já é do
// backend. Paginação (6.9.1) independente por lista — cada uma com sua
// própria `Pagination`, mesmo padrão de `FriendsList`/`RankingBoard`.
// Nome/username clicável pro perfil (6.9.10), mesmo padrão de
// `FriendsList`/`UserSearchResults`: `.profileLink` é irmão dos botões de
// ação, não aninhado, pra não ter elemento interativo dentro de elemento
// interativo.
export function FriendRequestsPanel({
    received,
    sent,
    receivedPage,
    receivedTotalPages,
    onReceivedPageChange,
    sentPage,
    sentTotalPages,
    onSentPageChange,
}: FriendRequestsPanelProps) {
    const navigate = useNavigate()
    const respondToRequest = useRespondToFriendRequestMutation()
    const removeFriendship = useRemoveFriendshipMutation()

    return (
        <div className={styles.panel}>
            <section>
                <h2 className={styles.sectionTitle}>Recebidas</h2>
                {received.length === 0 ? (
                    <p className={styles.empty}>Nenhuma solicitação recebida no momento.</p>
                ) : (
                    <ul className={styles.list}>
                        {received.map((request) => (
                            <li key={request.friendshipId} className={styles.row}>
                                <button type="button" className={styles.profileLink} onClick={() => navigate(`/perfil/${request.userId}`)}>
                                    <span className={styles.avatar} aria-hidden="true">
                                        {initials(request.username)}
                                    </span>
                                    <span className={styles.info}>
                                        <span className={styles.name}>{request.name}</span>
                                        <span className={styles.username}>@{request.username}</span>
                                    </span>
                                </button>
                                <div className={styles.actions}>
                                    <Button
                                        disabled={respondToRequest.isPending && respondToRequest.variables === request.friendshipId}
                                        onClick={() => respondToRequest.mutate(request.friendshipId)}
                                    >
                                        Aceitar
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        disabled={removeFriendship.isPending && removeFriendship.variables === request.friendshipId}
                                        onClick={() => removeFriendship.mutate(request.friendshipId)}
                                    >
                                        Recusar
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <Pagination
                    page={receivedPage}
                    totalPages={receivedTotalPages}
                    onPageChange={onReceivedPageChange}
                    ariaLabel="Paginação de solicitações recebidas"
                />
            </section>

            <section>
                <h2 className={styles.sectionTitle}>Enviadas</h2>
                {sent.length === 0 ? (
                    <p className={styles.empty}>Nenhuma solicitação enviada no momento.</p>
                ) : (
                    <ul className={styles.list}>
                        {sent.map((request) => (
                            <li key={request.friendshipId} className={styles.row}>
                                <button type="button" className={styles.profileLink} onClick={() => navigate(`/perfil/${request.userId}`)}>
                                    <span className={styles.avatar} aria-hidden="true">
                                        {initials(request.username)}
                                    </span>
                                    <span className={styles.info}>
                                        <span className={styles.name}>{request.name}</span>
                                        <span className={styles.username}>@{request.username}</span>
                                    </span>
                                </button>
                                <Button
                                    variant="secondary"
                                    disabled={removeFriendship.isPending && removeFriendship.variables === request.friendshipId}
                                    onClick={() => removeFriendship.mutate(request.friendshipId)}
                                >
                                    Cancelar
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                <Pagination
                    page={sentPage}
                    totalPages={sentTotalPages}
                    onPageChange={onSentPageChange}
                    ariaLabel="Paginação de solicitações enviadas"
                />
            </section>
        </div>
    )
}
