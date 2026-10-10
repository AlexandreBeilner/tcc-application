import { useNavigate } from 'react-router-dom'
import { Compass, PieChart, Target } from 'lucide-react'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import { useProgressionQuery } from '../../features/portfolio/useProgressionQuery'
import { useStreakQuery } from '../../features/portfolio/useStreakQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { nextUnlockFor } from '../../features/lessons/nextUnlockFor'
import { useMissionsQuery } from '../../features/missions/useMissionsQuery'
import { useNextSalaryPayment } from '../../features/market/useNextSalaryPayment'
import { groupPositionsByCategory } from '../../features/portfolio/distribution'
import { NetWorthCards } from '../../components/organisms/NetWorthCards'
import { ProgressionSummary } from '../../components/organisms/ProgressionSummary'
import { DistributionChart } from '../../components/organisms/DistributionChart'
import { ResumeLessonCard } from '../../components/organisms/ResumeLessonCard'
import { DailyMissionsList } from '../../components/organisms/DailyMissionsList'
import { SalaryIndicator } from '../../components/molecules/SalaryIndicator'
import { Button } from '../../components/atoms/Button'
import styles from './index.module.css'

// Tela 2.1 (tarefa 6.3) — tela padrão pós-login recorrente, montada em "/"
// (substitui o placeholder `Home.tsx`). Combina 5 queries independentes
// (conta, progressão, streak, lições, missões — a última entrou na 6.8) —
// cada uma com seu próprio loading, sem bloquear a tela inteira numa única
// tela de carregamento: os cards que já resolveram aparecem, os que faltam
// mostram "Carregando…" no próprio espaço. Seção "Missões do dia" (7.3)
// vive aqui em vez de rota própria, decisão explícita do inventário de
// telas ("pode viver como seção dentro do Portfólio... promover a tela
// própria se o catálogo crescer").
export function Portfolio() {
    const navigate = useNavigate()
    const accountQuery = useMyAccountQuery()
    const progressionQuery = useProgressionQuery()
    const streakQuery = useStreakQuery()
    const lessonsQuery = useLessonsQuery()
    const missionsQuery = useMissionsQuery()
    const daysUntilNextSalary = useNextSalaryPayment()

    const account = accountQuery.data
    const hasNoPositions = account && account.positions.length === 0 && account.fixedIncomePositions.length === 0
    const nextUnlock = lessonsQuery.data ? nextUnlockFor(lessonsQuery.data.lessons) : null

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfólio</h1>
                {progressionQuery.data && streakQuery.data ? (
                    <div className={styles.headerRight}>
                        <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} nextUnlock={nextUnlock} />
                        <SalaryIndicator monthlySalary={progressionQuery.data.monthlySalary} daysUntilNextPayment={daysUntilNextSalary} />
                    </div>
                ) : (
                    !progressionQuery.isError &&
                    !streakQuery.isError && <span className={styles.skeletonSummary} role="status" aria-label="Carregando progressão" />
                )}
            </header>

            {accountQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar sua conta agora. Tente novamente em instantes.
                </p>
            )}

            <div className={styles.columns}>
                <div className={styles.mainColumn}>
                    {!account && !accountQuery.isError && (
                        <div className={styles.skeletonCard} role="status" aria-label="Carregando conta" />
                    )}

                    {account && <NetWorthCards account={account} />}

                    {hasNoPositions && (
                        <section className={styles.emptyState}>
                            <span className={styles.emptyIcon} aria-hidden="true">
                                <Compass size={22} strokeWidth={2} />
                            </span>
                            <h2 className={styles.emptyTitle}>Você ainda não tem nenhuma posição</h2>
                            <p className={styles.emptyBody}>
                                Comece pela Trilha pra entender os produtos antes de investir, ou vá direto pro Mercado se já sabe o que
                                procura.
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
                </div>

                <div className={styles.sideColumn}>
                    {missionsQuery.data && missionsQuery.data.missions.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>
                                <Target size={18} strokeWidth={2} aria-hidden="true" />
                                Missões do dia
                            </h2>
                            <DailyMissionsList missions={missionsQuery.data.missions} streak={streakQuery.data?.currentStreak ?? 0} />
                        </section>
                    )}

                    {lessonsQuery.data && <ResumeLessonCard lessons={lessonsQuery.data.lessons} />}

                    <div className={styles.actions}>
                        <Button onClick={() => navigate('/mercado')}>Investir</Button>
                        <Button variant="secondary" onClick={() => navigate('/conquistas')}>
                            Conquistas
                        </Button>
                    </div>
                </div>
            </div>
        </main>
    )
}
