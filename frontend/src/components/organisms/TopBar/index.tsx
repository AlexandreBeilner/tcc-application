import { Link } from 'react-router-dom'
import { FriendsBell } from '../../molecules/FriendsBell'
import { NewsBell } from '../../molecules/NewsBell'
import { AvatarMenu } from '../AvatarMenu'
import styles from './index.module.css'

// Barra superior persistente (inventário 0.2): logo, ícone de amigos com
// badge (`FriendsBell`, 6.9.4), ícone de notícias com badge, avatar com
// menu suspenso. "Amigos" continua também no `AvatarMenu` — o pedido do
// autor foi "não só" dentro do menu, não a remoção do item de lá.
// "Investimenta" é um nome de placeholder — decisão confirmada com o
// usuário nesta sessão, sem marca definitiva escolhida ainda.
export function TopBar() {
    return (
        <header className={styles.topBar}>
            <Link to="/" className={styles.logo}>
                Investimenta
            </Link>
            <div className={styles.actions}>
                <FriendsBell />
                <NewsBell />
                <AvatarMenu />
            </div>
        </header>
    )
}
