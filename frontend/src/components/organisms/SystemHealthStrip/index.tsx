import type { HealthComponentKey, HealthStatus } from '../../../services/admin'
import type { SystemHealthStripProps } from './types'
import styles from './index.module.css'

export type { SystemHealthStripProps } from './types'

const LABELS: Record<HealthComponentKey, string> = {
    backend: 'Backend',
    engine: 'Motor',
    gamification_db: 'Banco de usuários',
    market_db: 'Banco de mercado',
    redis: 'Redis',
    email_outbox: 'Fila de e-mail',
}

const STATUS_LABELS: Record<HealthStatus, string> = {
    ok: 'No ar',
    degradado: 'Lento',
    fora: 'Fora',
}

// A fila de e-mail não é um serviço que cai: o aviso dela é "atenção", não "lento".
const OUTBOX_STATUS_LABELS: Record<HealthStatus, string> = {
    ok: 'Em dia',
    degradado: 'Atenção',
    fora: 'Fora',
}

// Faixa de saúde da visão geral (N.5). O estado nunca depende só de cor: o rótulo
// está sempre escrito e o formato da borda muda (sólido = no ar, tracejado = lento,
// destaque de erro = fora).
export function SystemHealthStrip({ components }: SystemHealthStripProps) {
    return (
        <ul className={styles.strip} aria-label="Saúde do sistema">
            {components.map(({ key, status, latency_ms, detail }) => (
                <li key={key} className={`${styles.item} ${styles[status]}`} title={detail ?? undefined}>
                    <span className={styles.name}>{LABELS[key]}</span>
                    <span className={styles.status}>{(key === 'email_outbox' ? OUTBOX_STATUS_LABELS : STATUS_LABELS)[status]}</span>
                    {latency_ms !== null && key !== 'backend' && key !== 'email_outbox' && (
                        <span className={styles.latency}>{latency_ms} ms</span>
                    )}
                    {detail && <span className={styles.detail}>{detail}</span>}
                </li>
            ))}
        </ul>
    )
}
