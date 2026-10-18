import { useParams } from 'react-router-dom'
import { AdminDailyPuzzle } from '../../components/organisms/AdminDailyPuzzle'
import styles from './index.module.css'

// Tela de um dia do Diário (DI.5.1): prévia como o jogador verá, com o gabarito, para conferir,
// corrigir e publicar. Vale para qualquer dia já preparado, futuro inclusive (rota de admin).
export function AdminDiarioJogo() {
    const { number } = useParams()
    return (
        <main className={styles.page}>
            <AdminDailyPuzzle number={Number(number)} />
        </main>
    )
}
