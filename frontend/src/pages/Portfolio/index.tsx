import { useNavigate } from 'react-router-dom'
import { Compass, PieChart } from 'lucide-react'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import { useProgressionQuery } from '../../features/portfolio/useProgressionQuery'
import { useStreakQuery } from '../../features/portfolio/useStreakQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { groupPositionsByCategory } from '../../features/portfolio/distribution'
import { NetWorthCards } from '../../components/organisms/NetWorthCards'
import { ProgressionSummary } from '../../components/organisms/ProgressionSummary'
import { DistributionChart } from '../../components/organisms/DistributionChart'
import { ResumeLessonCard } from '../../components/organisms/ResumeLessonCard'
import { Button } from '../../components/atoms/Button'
import styles from './index.module.css'

// Tela 2.1 (tarefa 6.3) — tela padrão pós-login recorrente, montada em "/"
// (substitui o placeholder `Home.tsx`). Combina 4 queries independentes
// (conta, progressão, streak, lições) — cada uma com seu próprio loading,
// sem bloquear a tela inteira numa única tela de carregamento: os cards
// que já resolveram aparecem, os que faltam mostram "Carregando…" no
// próprio espaço.
export function Portfolio() {
    const navigate = useNavigate()
    const accountQuery = useMyAccountQuery()
    const progressionQuery = useProgressionQuery()
    const streakQuery = useStreakQuery()
    const lessonsQuery = useLessonsQuery()

    const account = accountQuery.data
    const hasNoPositions = account && account.positions.length === 0 && account.fixedIncomePositions.length === 0

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfólio</h1>
                {progressionQuery.data && streakQuery.data ? (
                    <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} />
                ) : (
                    !progressionQuery.isError && !streakQuery.isError && <span className={styles.loading}>Carregando…</span>
                )}
            </header>

            {accountQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar sua conta agora. Tente novamente em instantes.
                </p>
            )}

            {!account && !accountQuery.isError && <p className={styles.loading}>Carregando conta…</p>}

            {account && <NetWorthCards account={account} />}

            {hasNoPositions && (
                <section className={styles.emptyState}>
                    <span className={styles.emptyIcon} aria-hidden="true">
                        <Compass size={22} strokeWidth={2} />
                    </span>
                    <h2 className={styles.emptyTitle}>Você ainda não tem nenhuma posição</h2>
                    <p className={styles.emptyBody}>
                        Comece pela Trilha pra entender os produtos antes de investir, ou vá direto pro Mercado se já sabe o que procura.
                    </p>
                    <div className={styles.emptyActions}>
                        <Button variant="secondary" onClick={() => navigate('/trilha')}>
                            Ir pra Trilha
                        </Button>
                        <Button onClick={() => navigate('/mercado')}>Ir pro Mercado</Button>
                    </div>
                </section>
            )}

            {account && !hasNoPositions && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <PieChart size={18} strokeWidth={2} aria-hidden="true" />
                        Distribuição
                    </h2>
                    <DistributionChart slices={groupPositionsByCategory(account.positions, account.fixedIncomePositions)} />
                </section>
            )}

            {lessonsQuery.data && <ResumeLessonCard lessons={lessonsQuery.data.lessons} />}

            <div className={styles.actions}>
                <Button onClick={() => navigate('/mercado')}>Investir</Button>
                <Button variant="secondary" onClick={() => navigate('/conquistas')}>
                    Conquistas
                </Button>
            </div>
        </main>
    )
}
