import { Bell, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { useUnreadNews } from '../../../features/shell/useUnreadNews'
import styles from './index.module.css'

// Ícone de notícias/eventos (inventário 0.2) → Feed de Notícias (5.1,
// tarefa 6.6). Badge de novidade: ver `unreadNews.ts` pro critério exato.
// `news_feed` virou gate rígido de rota na Fase Q (`RequiresUnlock` em
// `routes/router.tsx`, mesmo tratamento de Portfólio/Calculadora) —
// reversão da decisão original (7.0.1) de tratar notícia como conteúdo
// "sempre acessível, só aviso". O sino continua linkando pra `/noticias`
// mesmo travado (clicar redireciona pra lá, onde o card explica o que
// falta) — só troca o badge de novidade pelo cadeado, sem citar código de
// lição no aria-label (Fase Q: nunca "Lição X.X" fora do Mapa da Trilha).
export function NewsBell() {
    const hasUnread = useUnreadNews()
    const { unlockedKeys } = useUnlockedKeys()
    const locked = !unlockedKeys.has('news_feed')

    return (
        <Link
            to="/noticias"
            className={styles.bell}
            aria-label={locked ? 'Notícias e eventos de mercado, travado pela trilha' : 'Notícias e eventos de mercado'}
        >
            <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
            {locked && <Lock size={10} strokeWidth={2.5} className={styles.lockBadge} aria-hidden="true" />}
            {!locked && hasUnread && <span className={styles.badge} aria-label="Há novidades não vistas" />}
        </Link>
    )
}
