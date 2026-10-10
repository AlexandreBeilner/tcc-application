import { GraduationCap } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar'
import { trackNameFor } from '../../../utils/tracks'
import type { RecentActivityFeedProps } from './types'
import styles from './index.module.css'
import { ProSeal } from '../../atoms/ProSeal'

export type { RecentActivityFeedProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Fase G (Impulso 5) — seção "Atividade recente" no hub `/amigos` (G.2),
// dentro da tela existente, não uma rota nova. Tom de celebração: sem
// nenhum número ao lado além da data (RNF09 estrutural — o evento de G.1 já
// não carrega patrimônio/rentabilidade/XP, mas o reforço aqui é visual:
// nada parecido com métrica). Sem paginação — `GET /social-feed` já limita
// às últimas 20 entradas (`SOCIAL_FEED_LIMIT`), não existe "próxima página".
export function RecentActivityFeed({ events }: RecentActivityFeedProps) {
    if (events.length === 0) {
        return (
            <div className={styles.section}>
                <h2 className={styles.title}>Atividade recente</h2>
                <p className={styles.empty}>Quando seus amigos concluírem uma trilha, aparece por aqui.</p>
            </div>
        )
    }

    return (
        <div className={styles.section}>
            <h2 className={styles.title}>Atividade recente</h2>
            <ul className={styles.list}>
                {events.map((event, index) => (
                    <li key={`${event.userId}-${event.occurredAt}-${index}`} className={styles.row}>
                        <Avatar username={event.username} avatarUrl={event.avatarUrl} frame={event.cosmetics.frame} />
                        <span className={styles.body}>
                            <GraduationCap className={styles.icon} size={16} strokeWidth={2} aria-hidden="true" />
                            <span className={styles.text}>
                                <strong>{event.name}</strong>
                                {event.cosmetics.isPro && <ProSeal />} completou a Trilha {event.trackNumber}:{' '}
                                {event.trackNumber !== null ? trackNameFor(event.trackNumber) : ''}
                            </span>
                        </span>
                        <span className={styles.date}>{dateFormatter.format(new Date(event.occurredAt))}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
