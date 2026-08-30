import { AchievementsGrid } from '../../components/organisms/AchievementsGrid'
import { useAchievementsQuery } from '../../features/achievements/useAchievementsQuery'
import styles from './index.module.css'

// Tela 7.2 (RF09) — "dar destino real ao botão 'Conquistas' do Portfólio,
// hoje sem tela" (inventário). `GET /achievements` já devolve `progress`
// mesmo pras bloqueadas, então esta tela só busca e renderiza.
export function Conquistas() {
    const achievementsQuery = useAchievementsQuery()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Conquistas</h1>

            {achievementsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas conquistas agora. Tente novamente em instantes.
                </p>
            )}

            {!achievementsQuery.data && !achievementsQuery.isError && <p className={styles.loading}>Carregando conquistas…</p>}

            {achievementsQuery.data && <AchievementsGrid achievements={achievementsQuery.data.achievements} />}
        </main>
    )
}
