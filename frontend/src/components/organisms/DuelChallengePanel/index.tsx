import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import { useCreateDuelMutation } from '../../../features/duels/useDuels'
import { useAllFriendsQuery } from '../../../features/friendships/useAllFriendsQuery'
import { isProRequiredError } from '../../../services/client'
import { formatApiError } from '../../../utils/formatApiError'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import { ProInvite } from '../../molecules/ProInvite'
import type { DuelChallengePanelProps } from './types'
import styles from './index.module.css'

export type { DuelChallengePanelProps } from './types'

// Desafiar um amigo (MO.5.3). Desafiar é do plano PRO; aceitar um desafio é sempre de graça. Quem
// não é PRO vê o convite para conhecer o plano, nunca um bloqueio nem contador; cobrança
// desligada esconde o painel.
export function DuelChallengePanel({ busyUserIds, onCreated }: DuelChallengePanelProps) {
    const billing = useBillingStatusQuery().data
    const friendsQuery = useAllFriendsQuery()
    const create = useCreateDuelMutation()

    if (billing && !billing.isPro) {
        if (!billing.billingEnabled) return null
        return (
            <ProInvite context="duel" title="Desafiar um amigo">
                Lançar desafios faz parte do plano PRO. Aceitar o desafio de um amigo é sempre de graça.
            </ProInvite>
        )
    }

    const busy = new Set(busyUserIds)
    const candidates = (friendsQuery.data ?? []).filter((friend) => !busy.has(friend.userId))
    const errorMessage = create.isError
        ? isProRequiredError(create.error)
            ? 'Seu plano PRO não está ativo agora. Veja a situação em Configurações.'
            : formatApiError(create.error, 'Não foi possível lançar o desafio. Tente de novo.')
        : null

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
