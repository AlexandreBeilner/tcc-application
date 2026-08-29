import { Link } from 'react-router-dom'
import { NewsBell } from './NewsBell'
import { AvatarMenu } from './AvatarMenu'
import styles from './TopBar.module.css'

// Barra superior persistente (inventário 0.2): logo, ícone de notícias com
// badge, avatar com menu suspenso. "Investimenta" é um nome de
// placeholder — decisão confirmada com o usuário nesta sessão, sem marca
// definitiva escolhida ainda.
export function TopBar() {
    return (
        <header className={styles.topBar}>
            <Link to="/" className={styles.logo}>
                Investimenta
            </Link>
            <div className={styles.actions}>
                <NewsBell />
                <AvatarMenu />
            </div>
        </header>
    )
}
