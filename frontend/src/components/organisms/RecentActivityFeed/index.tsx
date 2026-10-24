import { GraduationCap, Landmark, Swords } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar'
import { trackNameFor } from '../../../utils/tracks'
import type { RecentActivityFeedProps } from './types'
import styles from './index.module.css'

export type { RecentActivityFeedProps } from './types'

// Texto do resultado de um duelo (MO.5.3): celebra, nunca expõe percentual nem quem perdeu.
function duelText(type: 'track_completed' | 'duel_won' | 'duel_draw' | 'assembly_participated', opponentName: string): string {
    return type === 'duel_draw' ? `empatou um duelo com ${opponentName}` : `venceu um duelo contra ${opponentName}`
}

// Participação em assembleia (MO.6.7): só o fato de ter participado, nunca em qual opção votou.
function assemblyText(subjectLabel: string, title: string): string {
    return `participou da assembleia de ${subjectLabel}: ${title}`
}

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
                <p className={styles.empty}>
                    Quando seus amigos concluírem uma trilha, vencerem um duelo ou participarem de uma assembleia, aparece por aqui.
                </p>
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
                            {event.assembly ? (
                                <Landmark className={styles.icon} size={16} strokeWidth={2} aria-hidden="true" />
                            ) : event.duel ? (
                                <Swords className={styles.icon} size={16} strokeWidth={2} aria-hidden="true" />
                            ) : (
                                <GraduationCap className={styles.icon} size={16} strokeWidth={2} aria-hidden="true" />
                            )}
                            <span className={styles.text}>
                                <strong>{event.name}</strong>{' '}
                                {event.assembly
                                    ? assemblyText(event.assembly.subjectLabel, event.assembly.title)
                                    : event.duel
                                      ? duelText(event.type, event.duel.opponentName)
                                      : `completou a Trilha ${event.trackNumber}: ${event.trackNumber !== null ? trackNameFor(event.trackNumber) : ''}`}
                            </span>
                        </span>
                        <span className={styles.date}>{dateFormatter.format(new Date(event.occurredAt))}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
