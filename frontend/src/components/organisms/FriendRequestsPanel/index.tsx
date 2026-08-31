import { useRemoveFriendshipMutation } from '../../../features/friendships/useRemoveFriendshipMutation'
import { useRespondToFriendRequestMutation } from '../../../features/friendships/useRespondToFriendRequestMutation'
import { Button } from '../../atoms/Button'
import type { FriendRequestsPanelProps } from './types'
import styles from './index.module.css'

export type { FriendRequestsPanelProps } from './types'

// Tela 8.3 — duas listas independentes sobre a mesma rota `DELETE
// /friendships/:id` (`.docs/backend/friendships.md`): "Recusar" (recebida)
// e "Cancelar" (enviada) são só rótulos diferentes pro mesmo
// `removeFriendship`, a autorização de quem pode fazer o quê já é do
// backend.
export function FriendRequestsPanel({ received, sent }: FriendRequestsPanelProps) {
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
                                <span className={styles.info}>
                                    <span className={styles.name}>{request.name}</span>
                                    <span className={styles.username}>@{request.username}</span>
                                </span>
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
            </section>

            <section>
                <h2 className={styles.sectionTitle}>Enviadas</h2>
                {sent.length === 0 ? (
                    <p className={styles.empty}>Nenhuma solicitação enviada no momento.</p>
                ) : (
                    <ul className={styles.list}>
                        {sent.map((request) => (
                            <li key={request.friendshipId} className={styles.row}>
                                <span className={styles.info}>
                                    <span className={styles.name}>{request.name}</span>
                                    <span className={styles.username}>@{request.username}</span>
                                </span>
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
            </section>
        </div>
    )
}
