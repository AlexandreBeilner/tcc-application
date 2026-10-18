import { useId, useState } from 'react'
import { Award, Flame, Pencil, UserCheck } from 'lucide-react'
import { resolveFriendshipStatus } from '../../../features/friendships/resolveFriendshipStatus'
import { useRemoveFriendshipMutation } from '../../../features/friendships/useRemoveFriendshipMutation'
import { useRespondToFriendRequestMutation } from '../../../features/friendships/useRespondToFriendRequestMutation'
import { useSendFriendRequestMutation } from '../../../features/friendships/useSendFriendRequestMutation'
import { computeLevelProgress } from '../../../features/portfolio/levelProgress'
import { computePodiumSparkline, PODIUM_SPARKLINE_HEIGHT, PODIUM_SPARKLINE_WIDTH } from '../../../features/ranking/podiumSparkline'
import { Avatar } from '../../atoms/Avatar'
import { Button } from '../../atoms/Button'
import { TermCollection } from '../TermCollection'
import { TrackTrophyCase } from '../TrackTrophyCase'
import type { PublicProfileCardProps } from './types'
import { Delta } from '../../atoms/Delta'
import styles from './index.module.css'
import { CosmeticTags } from '../../molecules/CosmeticTags'
import { AvatarFrame } from '../../atoms/AvatarFrame'

export type { PublicProfileCardProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Sparkline do card de rentabilidade (redesign 6.9.2) — mesmo princípio da
// 6.8.4 (`RankingBoard`): 2 âncoras reais (início da janela = 0%, agora =
// `profile.profitabilityPct`) com ruído determinístico entre elas sobre um
// grid "papel de gráfico" (identidade-visual-padroes.md §2/§4).
function ProfitSparkline({ seedKey, pct }: { seedKey: string; pct: number }) {
    const patternId = useId()
    const { linePath, fillPath } = computePodiumSparkline(seedKey, pct)
    const colorVar = pct >= 0 ? 'var(--color-gain-500)' : 'var(--color-loss-500)'

    return (
        <svg
            className={styles.sparkline}
            viewBox={`0 0 ${PODIUM_SPARKLINE_WIDTH} ${PODIUM_SPARKLINE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <pattern id={patternId} width="12" height="9" patternUnits="userSpaceOnUse">
                <path d="M12 0 0 0 0 9" fill="none" stroke={colorVar} strokeOpacity={0.12} strokeWidth={1} />
            </pattern>
            <rect x={0} y={0} width={PODIUM_SPARKLINE_WIDTH} height={PODIUM_SPARKLINE_HEIGHT} fill={`url(#${patternId})`} />
            <path d={fillPath} fill={colorVar} opacity={0.16} />
            <path d={linePath} fill="none" stroke={colorVar} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// Tela 8.4 (RF20/RNF09) — espelha 9.1 "Meu Perfil" (inventário, tarefa
// 6.10, ainda não implementada) só que com o `id` de terceiro; a própria
// resposta do backend é estruturalmente incapaz de trazer patrimônio
// absoluto (`.docs/backend/profile.md`), então não há nada a esconder
// aqui — só rentabilidade percentual, nível/xp, streak e conquistas
// desbloqueadas. Redesign 6.9.2 (apontado pelo autor: card nasceu genérico
// demais) reaproveita 3 motivos já existentes em vez de inventar um novo:
// anel de XP do `AvatarMenu` (§idênticos tokens/cálculo,
// `computeLevelProgress`), sparkline do pódio (6.8.4) no card de
// rentabilidade, e a convenção sólido-dourado de conquista do
// `AchievementsGrid` (aqui simplificada — só desbloqueadas chegam da API,
// sem progresso de bloqueada a revelar). Botão de amizade reaproveita a
// mesma `resolveFriendshipStatus` de 8.2 (`UserSearchResults`), cruzando
// contra as listas já buscadas pela página. "Desfazer amizade" (6.9.3) só
// aparece com `status === 'friend'` — confirmação leve em duas etapas.
// `status === 'self'` (tarefa 6.10.2, apontado pelo autor) não mostra mais
// um badge de texto, só o ícone de editar (`onEdit`, opcional, só passado
// por `MeuPerfil`/9.1) no lugar onde a ação de amizade ficaria em 8.4.
export function PublicProfileCard({
    profile,
    currentUserId,
    targetUserId,
    friends,
    sentRequests,
    receivedRequests,
    onEdit,
}: PublicProfileCardProps) {
    const sendRequest = useSendFriendRequestMutation()
    const respondToRequest = useRespondToFriendRequestMutation()
    const removeFriendship = useRemoveFriendshipMutation()
    const [confirmingUnfriend, setConfirmingUnfriend] = useState(false)
    const { status, friendshipId } = resolveFriendshipStatus({ currentUserId, targetUserId, friends, sentRequests, receivedRequests })
    const friendshipRowId = friends.find((friend) => friend.userId === targetUserId)?.friendshipId ?? null

    const ringPercent = computeLevelProgress(profile.xp, profile.level).progressRatio * 100
    const ringStyle = { background: `conic-gradient(var(--color-gamify-500) ${ringPercent}%, var(--color-border) ${ringPercent}%)` }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <AvatarFrame frame={profile.cosmetics.frame}>
                    <div
                        className={styles.avatarRing}
                        style={ringStyle}
                        title={`Nível ${profile.level}, ${profile.xp.toLocaleString('pt-BR')} XP`}
                    >
                        <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size="lg" />
                    </div>
                </AvatarFrame>

                <div className={styles.identity}>
                    <span className={styles.username}>@{profile.username}</span>
                    <span className={styles.levelPill}>Nível {profile.level}</span>
                    <CosmeticTags cosmetics={profile.cosmetics} />
                </div>

                <div className={styles.friendAction}>
                    {status === 'self' && onEdit && (
                        <button type="button" className={styles.editButton} onClick={onEdit} aria-label="Editar perfil">
                            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                    )}

                    {status === 'friend' && friendshipRowId && (
                        <>
                            <span className={styles.statusFriends}>
                                <UserCheck size={16} strokeWidth={2} aria-hidden="true" />
                                Amigos
                            </span>
                            {confirmingUnfriend ? (
                                <div className={styles.confirmActions}>
                                    <Button
                                        variant="secondary"
                                        disabled={removeFriendship.isPending}
                                        onClick={() => setConfirmingUnfriend(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        disabled={removeFriendship.isPending}
                                        onClick={() => {
                                            removeFriendship.mutate(friendshipRowId)
                                            setConfirmingUnfriend(false)
                                        }}
                                    >
                                        Confirmar
                                    </Button>
                                </div>
                            ) : (
                                <button type="button" className={styles.quietButton} onClick={() => setConfirmingUnfriend(true)}>
                                    Desfazer amizade
                                </button>
                            )}
                        </>
                    )}

                    {status === 'pendingSent' && (
                        <Button variant="secondary" disabled>
                            Pedido pendente
                        </Button>
                    )}

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
            </div>

            <dl className={styles.stats}>
                <div className={`${styles.stat} ${styles.statProfit}`}>
                    <dt className={styles.statLabel}>Rentabilidade · semana</dt>
                    <dd className={`${styles.statValue} tabular-nums`}>
                        <Delta percent={profile.profitabilityPct} variant="text" />
                    </dd>
                    <div className={styles.sparklineWrap}>
                        <ProfitSparkline seedKey={targetUserId} pct={profile.profitabilityPct} />
                    </div>
                </div>
                <div className={`${styles.stat} ${styles.statXp}`}>
                    <dt className={styles.statLabel}>XP</dt>
                    <dd className={`${styles.statValue} tabular-nums`}>{profile.xp.toLocaleString('pt-BR')}</dd>
                </div>
                <div className={styles.stat}>
                    <dt className={styles.statLabel}>Streak</dt>
                    <dd className={`${styles.statValue} ${styles.streak}`}>
                        <Flame size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        {profile.currentStreak} {profile.currentStreak === 1 ? 'dia' : 'dias'}
                    </dd>
                </div>
            </dl>

            <TrackTrophyCase completedTracks={profile.completedTracks} />

            <TermCollection completedLessonCodes={profile.completedLessonCodes} isOwn={currentUserId === targetUserId} />

            <div className={styles.achievements}>
                <h2 className={styles.achievementsTitle}>Conquistas desbloqueadas</h2>
                {profile.achievements.length === 0 ? (
                    <p className={styles.empty}>Nenhuma conquista desbloqueada ainda.</p>
                ) : (
                    <ul className={styles.achievementsGrid}>
                        {profile.achievements.map((achievement) => (
                            <li key={achievement.id} className={styles.achievementChip}>
                                <Award size={16} strokeWidth={2} aria-hidden="true" />
                                <span className={styles.achievementText}>
                                    <span className={styles.achievementName}>{achievement.name}</span>
                                    <span className={styles.achievementDate}>{dateFormatter.format(new Date(achievement.unlockedAt))}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
