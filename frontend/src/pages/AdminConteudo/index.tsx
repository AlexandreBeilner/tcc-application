import { AdminLessonsTable } from '../../components/organisms/AdminLessonsTable'
import styles from './index.module.css'

// Tela "Conteúdo" (N.18): as lições da trilha com o funil de cada uma e a publicação. A base pra calibrar o
// conteúdo (achado 020): onde o usuário abandona, quanto tempo leva e se acerta a aposta.
export function AdminConteudo() {
    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Conteúdo</h1>
                <p className={styles.subtitle}>Funil de cada lição e publicação na trilha.</p>
            </header>
            <AdminLessonsTable />
        </main>
    )
}
