import { useCreateDuelMutation } from '../../../features/duels/useDuels'
import { useAllFriendsQuery } from '../../../features/friendships/useAllFriendsQuery'
import { formatApiError } from '../../../utils/formatApiError'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import type { DuelChallengePanelProps } from './types'
import styles from './index.module.css'

export type { DuelChallengePanelProps } from './types'

// Desafiar um amigo (MO.5.3): lista os amigos que ainda não têm duelo aberto com a pessoa.
export function DuelChallengePanel({ busyUserIds, onCreated }: DuelChallengePanelProps) {
    const friendsQuery = useAllFriendsQuery()
    const create = useCreateDuelMutation()

    const busy = new Set(busyUserIds)
    const candidates = (friendsQuery.data ?? []).filter((friend) => !busy.has(friend.userId))
    const errorMessage = create.isError ? formatApiError(create.error, 'Não foi possível lançar o desafio. Tente de novo.') : null

    return (
        <section className={styles.section} aria-labelledby="duel-challenge-title">
            <h2 id="duel-challenge-title" className={styles.title}>
                Desafiar um amigo
            </h2>
            <p className={styles.note}>
                Duelo de 7 dias: vence quem tiver a maior rentabilidade no período. É preciso operar pelo menos uma vez, senão perde por
                abandono. Todo mundo que participa ganha o mesmo XP, vencendo ou não. Até 3 duelos ao mesmo tempo.
            </p>

            {friendsQuery.isLoading && <p className={styles.note}>Carregando amigos…</p>}
            {!friendsQuery.isLoading && candidates.length === 0 && (
                <p className={styles.note}>
                    {(friendsQuery.data ?? []).length === 0
                        ? 'Você ainda não tem amigos. Adicione amigos para desafiar.'
                        : 'Você já tem um duelo aberto com todos os seus amigos.'}
                </p>
            )}
            <ul className={styles.list}>
                {candidates.map((friend) => (
                    <li key={friend.userId} className={styles.row}>
                        <Avatar username={friend.username} avatarUrl={friend.avatarUrl} frame={friend.cosmetics.frame} />
                        <span className={styles.name}>{friend.name}</span>
                        <Button
                            variant="secondary"
                            disabled={create.isPending}
                            onClick={() => create.mutate(friend.userId, { onSuccess: (duel) => onCreated?.(duel.id) })}
                        >
                            Desafiar
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
