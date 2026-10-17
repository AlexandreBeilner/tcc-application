import { Link } from 'react-router-dom'
import { AdminDailyAgenda } from '../../components/organisms/AdminDailyAgenda'
import { AdminDailyLaunch } from '../../components/organisms/AdminDailyLaunch'
import { DAILY_ALERT_MESSAGES } from '../../features/admin/dailyAdmin'
import { useDailyOverviewQuery } from '../../features/admin/useAdminDaily'
import styles from './index.module.css'

// Tela "Diário" (DI.5.1): a estreia, a agenda dos próximos dias e a cobertura do conteúdo. É por aqui
// que o autor agenda a data de estreia, revisa e publica os jogos. Desktop: agenda larga à esquerda e
// o controle da estreia fixo à direita; abaixo de 1200px tudo empilha, com a estreia primeiro.
export function AdminDiario() {
    const overviewQuery = useDailyOverviewQuery()
    const overview = overviewQuery.data

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Diário</h1>
                    <p className={styles.subtitle}>
                        Estreia, agenda e revisão dos jogos. Nada vai ao ar sem revisão e publicação, e o gabarito só aparece aqui.
                    </p>
                </div>
                <Link to="/admin/diario/conteudo" className={styles.contentLink}>
                    Conteúdo do Diário
                </Link>
            </header>

            {overviewQuery.isLoading && <p className={styles.muted}>Carregando o Diário…</p>}
            {overviewQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o Diário agora.
                </p>
            )}

            {overview && (
                <>
                    {overview.alerts.length > 0 && (
                        <ul className={styles.alerts} aria-label="Alertas do Diário">
                            {overview.alerts.map((code) => (
                                <li key={code} className={styles.alert} role="alert">
                                    {DAILY_ALERT_MESSAGES[code]}
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className={styles.layout}>
                        <aside className={styles.side}>
                            <AdminDailyLaunch overview={overview} />
                        </aside>
                        <div className={styles.main}>
                            <AdminDailyAgenda overview={overview} />
                        </div>
                    </div>
                </>
            )}
        </main>
    )
}
