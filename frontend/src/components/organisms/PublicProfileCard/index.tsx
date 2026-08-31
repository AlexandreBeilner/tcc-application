import { Award, Flame } from 'lucide-react'
import { formatSignedPercent } from '../../../features/market/format'
import { resolveFriendshipStatus } from '../../../features/friendships/resolveFriendshipStatus'
import { useRespondToFriendRequestMutation } from '../../../features/friendships/useRespondToFriendRequestMutation'
import { useSendFriendRequestMutation } from '../../../features/friendships/useSendFriendRequestMutation'
import { Button } from '../../atoms/Button'
import type { PublicProfileCardProps } from './types'
import styles from './index.module.css'

export type { PublicProfileCardProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function initials(username: string): string {
    return username.charAt(0).toUpperCase()
}

function profitClassName(pct: number): string {
    if (pct > 0) return styles.gain
    if (pct < 0) return styles.loss
    return styles.neutral
}

// Tela 8.4 (RF20/RNF09) — espelha 9.1 "Meu Perfil" (inventário, tarefa
// 6.10, ainda não implementada) só que com o `id` de terceiro; a própria
// resposta do backend é estruturalmente incapaz de trazer patrimônio
// absoluto (`.docs/backend/profile.md`), então não há nada a esconder
// aqui — só rentabilidade percentual, nível/xp, streak e conquistas
// desbloqueadas. Botão de amizade reaproveita a mesma
// `resolveFriendshipStatus` de 8.2 (`UserSearchResults`), cruzando contra
// as listas já buscadas pela página — nenhum campo de amizade vem
// embutido no `GET /users/:id/profile`.
export function PublicProfileCard({
    profile,
    currentUserId,
    targetUserId,
    friends,
    sentRequests,
    receivedRequests,
}: PublicProfileCardProps) {
    const sendRequest = useSendFriendRequestMutation()
    const respondToRequest = useRespondToFriendRequestMutation()
    const { status, friendshipId } = resolveFriendshipStatus({ currentUserId, targetUserId, friends, sentRequests, receivedRequests })

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.avatar} aria-hidden="true">
                    {initials(profile.username)}
                </span>
                <div className={styles.identity}>
                    <span className={styles.username}>@{profile.username}</span>
                    <span className={styles.level}>Nível {profile.level}</span>
                </div>

                {status === 'self' && <span className={styles.selfNote}>Este é o seu perfil.</span>}

                {status === 'friend' && <span className={styles.status}>Amigos</span>}

                {status === 'pendingSent' && <span className={styles.status}>Pedido pendente</span>}

                {status === 'pendingReceived' && friendshipId && (
                    <Button disabled={respondToRequest.isPending} onClick={() => respondToRequest.mutate(friendshipId)}>
                        Aceitar
                    </Button>
                )}

                {status === 'none' && (
                    <Button variant="secondary" disabled={sendRequest.isPending} onClick={() => sendRequest.mutate(profile.username)}>
                        Adicionar
                    </Button>
                )}
            </div>

            <dl className={styles.stats}>
                <div className={styles.stat}>
                    <dt>Rentabilidade (semana)</dt>
                    <dd className={`${styles.statValue} tabular-nums ${profitClassName(profile.profitabilityPct)}`}>
                        {formatSignedPercent(profile.profitabilityPct)}
                    </dd>
                </div>
                <div className={styles.stat}>
                    <dt>XP</dt>
                    <dd className={`${styles.statValue} tabular-nums`}>{profile.xp.toLocaleString('pt-BR')}</dd>
                </div>
                <div className={styles.stat}>
                    <dt>Streak</dt>
                    <dd className={`${styles.statValue} ${styles.streak}`}>
                        <Flame size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        {profile.currentStreak} {profile.currentStreak === 1 ? 'dia' : 'dias'}
                    </dd>
                </div>
            </dl>

            <div className={styles.achievements}>
                <h2 className={styles.achievementsTitle}>Conquistas desbloqueadas</h2>
                {profile.achievements.length === 0 ? (
                    <p className={styles.empty}>Nenhuma conquista desbloqueada ainda.</p>
                ) : (
                    <ul className={styles.achievementsList}>
                        {profile.achievements.map((achievement) => (
                            <li key={achievement.id} className={styles.achievement}>
                                <Award size={16} strokeWidth={2} aria-hidden="true" />
                                <span className={styles.achievementName}>{achievement.name}</span>
                                <span className={styles.achievementDate}>{dateFormatter.format(new Date(achievement.unlockedAt))}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
