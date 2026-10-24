import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { LeagueCard } from '../../components/molecules/LeagueCard'
import { LeagueCreateForm } from '../../components/organisms/LeagueCreateForm'
import { useLeaguesQuery, useRespondToLeagueInvitationMutation } from '../../features/leagues/useLeagues'
import styles from './index.module.css'

// Ligas privadas (MO.5.2c): as ligas em que a pessoa participa, os convites pendentes e a
// criação. Composição própria no desktop: lista à esquerda, criação
// numa coluna fixa à direita (identidade-visual-padroes.md §7).
export function Ligas() {
    const navigate = useNavigate()
    const leaguesQuery = useLeaguesQuery()
    const respond = useRespondToLeagueInvitationMutation()
    const leagues = leaguesQuery.data ?? []
    const invitations = leagues.filter((league) => league.status === 'invited')
    const mine = leagues.filter((league) => league.status === 'active')

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Ligas</h1>
            <p className={styles.lead}>
                Ligas são disputas privadas entre amigos. A pontuação é a rentabilidade percentual do período, a mesma do ranking, e ninguém
                vê quanto o outro tem.
            </p>

            <div className={styles.layout}>
                <div className={styles.main}>
                    {leaguesQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar suas ligas agora. Tente novamente em instantes.
                        </p>
                    )}
                    {leaguesQuery.isLoading && <p className={styles.muted}>Carregando ligas…</p>}

                    {invitations.length > 0 && (
                        <section aria-labelledby="league-invites-title" className={styles.block}>
                            <h2 id="league-invites-title" className={styles.sectionTitle}>
                                Convites
                            </h2>
                            <ul className={styles.list}>
                                {invitations.map((league) => (
                                    <li key={league.id} className={styles.invite}>
                                        <span className={styles.inviteText}>
                                            <strong>@{league.ownerUsername}</strong> convidou você para a liga{' '}
                                            <strong>{league.name}</strong>.
                                        </span>
                                        <div className={styles.inviteActions}>
                                            <Button
                                                disabled={respond.isPending}
                                                onClick={() => respond.mutate({ id: league.id, accept: true })}
                                            >
                                                Aceitar
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                disabled={respond.isPending}
                                                onClick={() => respond.mutate({ id: league.id, accept: false })}
                                            >
                                                Recusar
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section aria-labelledby="league-mine-title" className={styles.block}>
                        <h2 id="league-mine-title" className={styles.sectionTitle}>
                            Suas ligas
                        </h2>
                        {mine.length === 0 && !leaguesQuery.isLoading ? (
                            <p className={styles.muted}>
                                Você ainda não participa de nenhuma liga. Quando um amigo convidar você, o convite aparece aqui.
                            </p>
                        ) : (
                            <ul className={styles.list}>
                                {mine.map((league) => (
                                    <li key={league.id}>
                                        <LeagueCard league={league} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <aside className={styles.side} aria-label="Criar liga">
                    <LeagueCreateForm onCreated={(id) => navigate(`/ligas/${id}`)} />
                </aside>
            </div>
        </main>
    )
}
