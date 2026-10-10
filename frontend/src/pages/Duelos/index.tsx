import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { DuelCard } from '../../components/molecules/DuelCard'
import { DuelChallengePanel } from '../../components/organisms/DuelChallengePanel'
import { useDuelsQuery, useRespondToDuelMutation } from '../../features/duels/useDuels'
import styles from './index.module.css'

// Duelos entre amigos (MO.5.3): convites recebidos, duelos em andamento, desafios que a pessoa
// lançou e o histórico. Aceitar nunca exige plano; desafiar é do PRO. No desktop a lista fica à
// esquerda e o painel de desafio fixo à direita (identidade-visual-padroes.md §7).
export function Duelos() {
    const navigate = useNavigate()
    const duelsQuery = useDuelsQuery()
    const respond = useRespondToDuelMutation()
    const duels = duelsQuery.data ?? []
    const invitations = duels.filter((duel) => duel.status === 'pending' && duel.role === 'opponent')
    const active = duels.filter((duel) => duel.status === 'active')
    const sent = duels.filter((duel) => duel.status === 'pending' && duel.role === 'challenger')
    const history = duels.filter((duel) => ['finished', 'declined', 'cancelled', 'expired'].includes(duel.status))
    const busyUserIds = duels.filter((duel) => duel.status === 'pending' || duel.status === 'active').map((duel) => duel.opponent.id)

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Duelos</h1>
            <p className={styles.lead}>
                Um duelo é um desafio de 7 dias entre dois amigos. Vence a maior rentabilidade no período, e ninguém vê quanto o outro tem.
            </p>

            <div className={styles.layout}>
                <div className={styles.main}>
                    {duelsQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar seus duelos agora. Tente novamente em instantes.
                        </p>
                    )}
                    {duelsQuery.isLoading && <p className={styles.muted}>Carregando duelos…</p>}

                    {invitations.length > 0 && (
                        <section aria-labelledby="duel-invites-title" className={styles.block}>
                            <h2 id="duel-invites-title" className={styles.sectionTitle}>
                                Convites
                            </h2>
                            <ul className={styles.list}>
                                {invitations.map((duel) => (
                                    <li key={duel.id} className={styles.invite}>
                                        <span className={styles.inviteText}>
                                            <strong>{duel.opponent.name}</strong> desafiou você para um duelo de 7 dias.
                                        </span>
                                        <div className={styles.inviteActions}>
                                            <Button
                                                disabled={respond.isPending}
                                                onClick={() => respond.mutate({ id: duel.id, accept: true })}
                                            >
                                                Aceitar
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                disabled={respond.isPending}
                                                onClick={() => respond.mutate({ id: duel.id, accept: false })}
                                            >
                                                Recusar
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {respond.isError && (
                                <p className={styles.error} role="alert">
                                    Não foi possível responder agora. Se você já tem 3 duelos em andamento, espere um terminar.
                                </p>
                            )}
                        </section>
                    )}

                    <section aria-labelledby="duel-active-title" className={styles.block}>
                        <h2 id="duel-active-title" className={styles.sectionTitle}>
                            Em andamento
                        </h2>
                        {active.length === 0 && !duelsQuery.isLoading ? (
                            <p className={styles.muted}>Nenhum duelo em andamento. Desafie um amigo ou aceite um convite.</p>
                        ) : (
                            <ul className={styles.list}>
                                {active.map((duel) => (
                                    <li key={duel.id}>
                                        <DuelCard duel={duel} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {sent.length > 0 && (
                        <section aria-labelledby="duel-sent-title" className={styles.block}>
                            <h2 id="duel-sent-title" className={styles.sectionTitle}>
                                Desafios enviados
                            </h2>
                            <ul className={styles.list}>
                                {sent.map((duel) => (
                                    <li key={duel.id}>
                                        <DuelCard duel={duel} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {history.length > 0 && (
                        <section aria-labelledby="duel-history-title" className={styles.block}>
                            <h2 id="duel-history-title" className={styles.sectionTitle}>
                                Histórico
                            </h2>
                            <ul className={styles.list}>
                                {history.map((duel) => (
                                    <li key={duel.id}>
                                        <DuelCard duel={duel} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <aside className={styles.side} aria-label="Desafiar um amigo">
                    <DuelChallengePanel busyUserIds={busyUserIds} onCreated={(id) => navigate(`/duelos/${id}`)} />
                </aside>
            </div>
        </main>
    )
}
