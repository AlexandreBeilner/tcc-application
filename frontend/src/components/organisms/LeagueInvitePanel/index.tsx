import { useAllFriendsQuery } from '../../../features/friendships/useAllFriendsQuery'
import { useInviteToLeagueMutation } from '../../../features/leagues/useLeagues'
import { isProRequiredError } from '../../../services/client'
import { formatApiError } from '../../../utils/formatApiError'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import type { LeagueInvitePanelProps } from './types'
import styles from './index.module.css'

export type { LeagueInvitePanelProps } from './types'

// Convidar amigos para a liga (MO.5.2c): só aparecem amigos com amizade aceita que ainda não estão
// na liga nem foram convidados. Quem recebe o convite não precisa de plano para aceitar.
export function LeagueInvitePanel({ leagueId, takenUserIds, onCancelInvite, pendingInvites }: LeagueInvitePanelProps) {
    const friendsQuery = useAllFriendsQuery()
    const invite = useInviteToLeagueMutation()
    const taken = new Set(takenUserIds)
    const candidates = (friendsQuery.data ?? []).filter((friend) => !taken.has(friend.userId))

    const errorMessage = invite.isError
        ? isProRequiredError(invite.error)
            ? 'Seu plano PRO não está ativo agora, então não dá para convidar. Veja a situação em Configurações.'
            : formatApiError(invite.error, 'Não foi possível convidar. Tente de novo.')
        : null

    return (
        <section className={styles.section} aria-labelledby="league-invite-title">
            <h2 id="league-invite-title" className={styles.title}>
                Convidar amigos
            </h2>

            {pendingInvites.length > 0 && (
                <div>
                    <h3 className={styles.subtitle}>Convites enviados, aguardando resposta</h3>
                    <ul className={styles.list}>
                        {pendingInvites.map((pending) => (
                            <li key={pending.userId} className={styles.row}>
                                <span className={styles.name}>@{pending.username}</span>
                                <Button variant="secondary" onClick={() => onCancelInvite(pending.userId)}>
                                    Cancelar
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {friendsQuery.isLoading && <p className={styles.hint}>Carregando amigos…</p>}
            {!friendsQuery.isLoading && candidates.length === 0 && (
                <p className={styles.hint}>
                    {(friendsQuery.data ?? []).length === 0
                        ? 'Você ainda não tem amigos. Adicione amigos para convidar.'
                        : 'Todos os seus amigos já estão nesta liga ou foram convidados.'}
                </p>
            )}
            <ul className={styles.list}>
                {candidates.map((friend) => (
                    <li key={friend.userId} className={styles.row}>
                        <Avatar username={friend.username} avatarUrl={friend.avatarUrl} frame={friend.cosmetics.frame} />
                        <span className={styles.name}>{friend.name}</span>
                        <Button
                            variant="secondary"
                            disabled={invite.isPending && invite.variables?.userId === friend.userId}
                            onClick={() => invite.mutate({ id: leagueId, userId: friend.userId })}
                        >
                            Convidar
                        </Button>
                    </li>
                ))}
            </ul>

            {errorMessage && (
                <p className={styles.error} role="alert">
                    {errorMessage}
                </p>
            )}
        </section>
    )
}
