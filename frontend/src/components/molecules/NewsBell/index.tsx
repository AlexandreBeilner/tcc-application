import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUnreadNews } from '../../../features/shell/useUnreadNews'
import styles from './index.module.css'

// Ícone de notícias/eventos (inventário 0.2) → Feed de Notícias (5.1,
// tarefa 6.6). Badge de novidade: ver `unreadNews.ts` pro critério exato.
export function NewsBell() {
    const hasUnread = useUnreadNews()

    return (
        <Link to="/noticias" className={styles.bell} aria-label="Notícias e eventos de mercado">
            <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
            {hasUnread && <span className={styles.badge} aria-label="Há novidades não vistas" />}
        </Link>
    )
}
