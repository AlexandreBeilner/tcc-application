import { DiarioGame } from '../../components/organisms/DiarioGame'
import styles from './index.module.css'

// Diário Selucra (DI.4.1): três desafios por dia, iguais para todos. Logado, o jogo do dia rende XP e
// conta para a sequência. Rota fora do `RequiresUnlock`: não é produto da trilha, está sempre aberta.
export function Diario() {
    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Diário Selucra</h1>
            <DiarioGame />
        </main>
    )
}
