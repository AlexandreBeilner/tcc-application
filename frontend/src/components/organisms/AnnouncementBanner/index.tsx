import { X } from 'lucide-react'
import type { ActiveAnnouncement } from '../../../services/announcements'
import type { AnnouncementBannerProps } from './types'
import styles from './index.module.css'

export type { AnnouncementBannerProps } from './types'

// A severidade nunca vai só na cor: o rótulo em texto acompanha (acessibilidade e daltonismo).
function severityLabel(announcement: ActiveAnnouncement): string {
    if (announcement.kind === 'maintenance') return 'Manutenção'
    if (announcement.severity === 'critical') return 'Importante'
    if (announcement.severity === 'warning') return 'Atenção'
    return 'Aviso'
}

// Faixa de comunicados globais no topo do app (N.20). O texto é puro e entra como texto do
// React (escapado), nunca como HTML. Crítico e manutenção anunciam como `alert`; o resto, `status`.
export function AnnouncementBanner({ announcements, onDismiss }: AnnouncementBannerProps) {
    if (announcements.length === 0) return null

    return (
        <section className={styles.stack} aria-label="Comunicados">
            {announcements.map((announcement) => (
                <div
                    key={announcement.id}
                    className={`${styles.banner} ${styles[announcement.severity]}`}
                    role={announcement.severity === 'critical' ? 'alert' : 'status'}
                >
                    <div className={styles.text}>
                        <span className={styles.label}>{severityLabel(announcement)}</span>
                        <strong className={styles.title}>{announcement.title}</strong>
                        <span className={styles.body}>{announcement.body}</span>
                    </div>
                    {announcement.dismissible && (
                        <button
                            type="button"
                            className={styles.dismiss}
                            aria-label={`Dispensar comunicado: ${announcement.title}`}
                            onClick={() => onDismiss(announcement.id)}
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    )}
                </div>
            ))}
        </section>
    )
}
