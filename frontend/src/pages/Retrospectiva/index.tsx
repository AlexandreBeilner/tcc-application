import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { RetrospectiveReport } from '../../components/organisms/RetrospectiveReport'
import { useAuth } from '../../features/auth/AuthContext'
import { useMyCosmeticsQuery } from '../../features/cosmetics/useMyCosmetics'
import { useRetrospectiveMonthsQuery, useRetrospectiveQuery } from '../../features/retrospective/useRetrospective'
import { monthLabel } from '../../features/retrospective/shareCard'
import styles from './index.module.css'

// Retrospectiva mensal (MO.5.4): o mês que acabou, em cartões para ver e compartilhar. Só meses
// fechados, do mês de cadastro em diante. Quem cancelou o PRO volta à versão simples; nada é
// apagado e o arquivo completo volta ao reativar.
export function Retrospectiva() {
    const { user } = useAuth()
    const monthsQuery = useRetrospectiveMonthsQuery()
    const mine = useMyCosmeticsQuery().data
    const [chosen, setChosen] = useState<string | null>(null)
    const months = monthsQuery.data ?? []
    const month = chosen ?? months[0] ?? null
    const query = useRetrospectiveQuery(month)

    return (
        <main className={styles.page}>
            <Link to="/perfil" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Meu Perfil
            </Link>
            <h1 className={styles.title}>Retrospectiva</h1>
            <p className={styles.lead}>O resumo do seu mês: o que você estudou, conquistou e como foi o ritmo.</p>

            {monthsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas retrospectivas agora. Tente novamente em instantes.
                </p>
            )}
            {monthsQuery.isLoading && <p className={styles.muted}>Carregando…</p>}

            {monthsQuery.data && months.length === 0 && (
                <p className={styles.muted}>
                    Sua primeira retrospectiva aparece quando o seu primeiro mês completo terminar. Até lá, siga a trilha.
                </p>
            )}

            {months.length > 0 && (
                <div className={styles.pills} role="group" aria-label="Mês">
                    {months.map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={[styles.pill, value === month && styles.pillActive].filter(Boolean).join(' ')}
                            aria-pressed={value === month}
                            onClick={() => setChosen(value)}
                        >
                            {monthLabel(value)}
                        </button>
                    ))}
                </div>
            )}

            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar essa retrospectiva agora. Tente novamente em instantes.
                </p>
            )}
            {month && query.isLoading && <p className={styles.muted}>Montando a retrospectiva…</p>}

            {query.data && user && (
                <RetrospectiveReport
                    retrospective={query.data}
                    identity={{
                        username: user.username,
                        isPro: query.data.full && (mine?.display.isPro ?? false),
                        frame: mine?.display.frame ?? null,
                        title: mine?.display.title ?? null,
                    }}
                />
            )}
        </main>
    )
}
