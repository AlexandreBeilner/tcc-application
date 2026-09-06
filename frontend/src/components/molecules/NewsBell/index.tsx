import { Bell, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { useUnreadNews } from '../../../features/shell/useUnreadNews'
import styles from './index.module.css'

// Ícone de notícias/eventos (inventário 0.2) → Feed de Notícias (5.1,
// tarefa 6.6). Badge de novidade: ver `unreadNews.ts` pro critério exato.
// `news_feed` (tarefa 7.0.1): decisão de UX desta sessão — conteúdo
// só-leitura e de baixo risco, então o acesso nunca é bloqueado de fato
// (diferente do gate rígido de Portfólio/Calculadora), só um aviso visual
// (cadeado no lugar do badge de novidade) até a lição 2.4.
export function NewsBell() {
    const hasUnread = useUnreadNews()
    const { unlockedKeys } = useUnlockedKeys()
    const locked = !unlockedKeys.has('news_feed')

    return (
        <Link
            to="/noticias"
            className={styles.bell}
            aria-label={locked ? 'Notícias e eventos de mercado — desbloqueia na lição 2.4' : 'Notícias e eventos de mercado'}
        >
            <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
            {locked && <Lock size={10} strokeWidth={2.5} className={styles.lockBadge} aria-hidden="true" />}
            {!locked && hasUnread && <span className={styles.badge} aria-label="Há novidades não vistas" />}
        </Link>
    )
}
