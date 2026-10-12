import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { DuelScoreboard } from '../../components/organisms/DuelScoreboard'
import { useAuth } from '../../features/auth/AuthContext'
import { useMyCosmeticsQuery } from '../../features/cosmetics/useMyCosmetics'
import { useCancelDuelMutation, useDuelQuery, useRespondToDuelMutation } from '../../features/duels/useDuels'
import { ApiError } from '../../services/client'
import { formatApiError } from '../../utils/formatApiError'
import styles from './index.module.css'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Detalhe do duelo (MO.5.3): placar lado a lado (parcial enquanto corre, definitivo depois) e as
// ações possíveis em cada estado. Duelo em andamento não se cancela: vai até o fim.
export function DuelDetalhe() {
    const { id = '' } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const query = useDuelQuery(id)
    const mine = useMyCosmeticsQuery().data
    const respond = useRespondToDuelMutation()
    const cancel = useCancelDuelMutation()

    if (query.isError) {
        const notFound = query.error instanceof ApiError && query.error.status === 404
        return (
            <main className={styles.page}>
                <Link to="/duelos" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Duelos
                </Link>
                <p className={styles.error} role="alert">
                    {notFound ? 'Duelo não encontrado.' : 'Não foi possível carregar o duelo agora.'}
                </p>
            </main>
        )
    }
    if (!query.data || !user) {
        return (
            <main className={styles.page}>
                <p className={styles.muted}>Carregando duelo…</p>
            </main>
        )
    }

    const duel = query.data
    const respondError = respond.isError ? formatApiError(respond.error, 'Não foi possível responder agora. Tente de novo.') : null

    return (
        <main className={styles.page}>
            <Link to="/duelos" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Duelos
            </Link>

            <header className={styles.header}>
                <h1 className={styles.title}>Duelo com {duel.opponent.name}</h1>
                {duel.startsAt && duel.endsAt && (
                    <p className={styles.meta}>
                        De {dateFormatter.format(new Date(duel.startsAt))} até {dateFormatter.format(new Date(duel.endsAt))}
                    </p>
                )}
            </header>

            {duel.status === 'pending' && duel.role === 'opponent' && (
                <section className={styles.callout} aria-label="Convite">
                    <p className={styles.calloutText}>
                        <strong>{duel.opponent.name}</strong> desafiou você para um duelo de 7 dias. Vence a maior rentabilidade no período.
                        Participar é de graça e rende o mesmo XP para os dois, vencendo ou não.
                    </p>
                    <div className={styles.row}>
                        <Button disabled={respond.isPending} onClick={() => respond.mutate({ id, accept: true })}>
                            Aceitar
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={respond.isPending}
                            onClick={() => respond.mutate({ id, accept: false }, { onSuccess: () => navigate('/duelos') })}
                        >
                            Recusar
                        </Button>
                    </div>
                    {respondError && (
                        <p className={styles.error} role="alert">
                            {respondError}
                        </p>
                    )}
                </section>
            )}

            {duel.status === 'pending' && duel.role === 'challenger' && (
                <section className={styles.callout} aria-label="Aguardando resposta">
                    <p className={styles.calloutText}>
                        Aguardando {duel.opponent.name} responder. Se não responder até {dateFormatter.format(new Date(duel.expiresAt))}, o
                        desafio é encerrado e a vaga volta para você.
                    </p>
                    <div className={styles.row}>
                        <Button
                            variant="secondary"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(id, { onSuccess: () => navigate('/duelos') })}
                        >
                            Cancelar desafio
                        </Button>
                    </div>
                </section>
            )}

            {(duel.status === 'active' || duel.status === 'finished') && (
                <DuelScoreboard
                    duel={duel}
                    you={{ username: user.username, avatarUrl: user.avatarUrl, frame: mine?.display.frame ?? null }}
                />
            )}

            {duel.status === 'declined' && <p className={styles.muted}>Este desafio foi recusado.</p>}
            {duel.status === 'cancelled' && <p className={styles.muted}>Este desafio foi cancelado.</p>}
            {duel.status === 'expired' && <p className={styles.muted}>Este desafio não foi respondido a tempo e foi encerrado.</p>}
        </main>
    )
}
