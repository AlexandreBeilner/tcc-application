import { Link } from 'react-router-dom'
import { useUnreadNews } from './useUnreadNews'
import styles from './NewsBell.module.css'

// Ícone de notícias/eventos (inventário 0.2) → Feed de Notícias (5.1,
// tarefa 6.6). Badge de novidade: ver `unreadNews.ts` pro critério exato.
export function NewsBell() {
  const hasUnread = useUnreadNews()

  return (
    <Link to="/noticias" className={styles.bell} aria-label="Notícias e eventos de mercado">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 21a2.5 2.5 0 0 0 5 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {hasUnread && <span className={styles.badge} aria-label="Há novidades não vistas" />}
    </Link>
  )
}
