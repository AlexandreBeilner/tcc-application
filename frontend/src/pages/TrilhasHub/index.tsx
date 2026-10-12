import { Link, useNavigate } from 'react-router-dom'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { groupLessonsByTrack } from '../../features/lessons/trackGroups'
import { nextUnlockFor } from '../../features/lessons/nextUnlockFor'
import { useProgressionQuery } from '../../features/portfolio/useProgressionQuery'
import { useStreakQuery } from '../../features/portfolio/useStreakQuery'
import { useNextSalaryPayment } from '../../features/market/useNextSalaryPayment'
import { ProgressionSummary } from '../../components/organisms/ProgressionSummary'
import { ResumeLessonCard } from '../../components/organisms/ResumeLessonCard'
import { TrackCard } from '../../components/organisms/TrackCard'
import { InstallInvite } from '../../components/molecules/InstallInvite'
import { SalaryIndicator } from '../../components/molecules/SalaryIndicator'
import styles from './index.module.css'

// Tela 3.1 redesenhada (backlog engajamento O.1, mockup vivo em
// `.claude/backlog-engajamento-gamificacao.md` Fase O/O.0) — troca o
// acordeão antigo de 4 `<details>` com gráfico horizontal embutido por uma
// grade de cards de trilha, no espírito de uma watchlist (uma trilha = um
// "ativo"). O gráfico horizontal e o nó de lição inline que o acordeão usava
// foram retirados na O.4, depois que a O.3 (mapa vertical) já existia.
export function TrilhasHub() {
    const navigate = useNavigate()
    const lessonsQuery = useLessonsQuery()
    const progressionQuery = useProgressionQuery()
    const streakQuery = useStreakQuery()
    const daysUntilNextSalary = useNextSalaryPayment()

    const lessons = lessonsQuery.data?.lessons ?? []
    const groups = groupLessonsByTrack(lessons)
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
    const nextUnlock = nextUnlockFor(lessons)

    // "Bloqueio é convite" (Fase J/K): mesmo uma trilha 100% bloqueada
    // navega pro mapa dela (`/trilha/mapa/:trackNumber`, O.3), que mostra os
    // nós travados em vez de negar a entrada.
    function handleTrackClick(trackNumber: number) {
        navigate(`/trilha/mapa/${trackNumber}`)
    }

    return (
        <main className={styles.page}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Trilhas</h1>
                        {lessons.length > 0 && (
                            <span className={styles.progress}>
                                {completedCount} de {lessons.length} lições concluídas no total
                            </span>
                        )}
                        <Link to="/glossario" className={styles.glossaryLink}>
                            Glossário
                        </Link>
                    </header>

                    {lessonsQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar as trilhas agora. Tente novamente em instantes.
                        </p>
                    )}

                    {!lessonsQuery.data && !lessonsQuery.isError && <p className={styles.loading}>Carregando trilhas…</p>}

                    <div className={styles.grid}>
                        {groups.map((group) => (
                            <TrackCard key={group.trackNumber} group={group} onClick={() => handleTrackClick(group.trackNumber)} />
                        ))}
                    </div>
                </div>

                <aside className={styles.sidebar}>
                    {progressionQuery.data && streakQuery.data && (
                        <>
                            <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} nextUnlock={nextUnlock} />
                            <SalaryIndicator
                                monthlySalary={progressionQuery.data.monthlySalary}
                                daysUntilNextPayment={daysUntilNextSalary}
                            />
                        </>
                    )}
                    {lessons.length > 0 && <ResumeLessonCard lessons={lessons} />}
                    {/* LW.2.4: convite para instalar o app, só depois da primeira lição concluída. */}
                    {completedCount > 0 && <InstallInvite placement="lesson" />}
                </aside>
            </div>
        </main>
    )
}
