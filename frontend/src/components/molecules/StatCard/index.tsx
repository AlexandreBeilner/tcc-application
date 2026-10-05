import { Link } from 'react-router-dom'
import type { StatCardProps } from './types'
import styles from './index.module.css'

export type { StatCardProps } from './types'

// Cartão da visão geral do painel (N.5): um título, números em lista de definição e,
// opcionalmente, o caminho pra tela da seção. Fonte fora do ar aparece como aviso,
// sem derrubar os outros cartões.
export function StatCard({ title, to, linkLabel, unavailable, children }: StatCardProps) {
    return (
        <section className={styles.card} aria-label={title}>
            <header className={styles.header}>
                <h2 className={styles.title}>{title}</h2>
                {to && (
                    <Link to={to} className={styles.link}>
                        {linkLabel ?? 'Ver detalhes'}
                    </Link>
                )}
            </header>
            {unavailable !== undefined ? (
                <p className={styles.unavailable} role="status">
                    Indisponível: {unavailable}
                </p>
            ) : (
                <dl className={styles.facts}>{children}</dl>
            )}
        </section>
    )
}

export function StatFact({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.fact}>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    )
}
