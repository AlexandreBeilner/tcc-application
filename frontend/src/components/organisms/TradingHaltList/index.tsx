import { formatDateTime } from '../../../features/admin/timeFormat'
import type { TradingHalt } from '../../../services/admin'
import type { TradingHaltListProps } from './types'
import styles from './index.module.css'

export type { TradingHaltListProps } from './types'

function scopeLabel(halt: TradingHalt): string {
    return halt.scope === 'global' ? 'Todo o mercado' : (halt.ticker ?? 'Ativo')
}

// Pausas de negociação (N.9). Vigente tem selo sólido e "Retomar"; encerrada, selo
// tracejado e a data da retomada (convenção sólido/tracejado do app, nunca só cor).
export function TradingHaltList({ halts, onLift, liftingId = null, emptyMessage }: TradingHaltListProps) {
    if (halts.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

    return (
        <ul className={styles.list}>
            {halts.map((halt) => (
                <li key={halt.id} className={styles.item}>
                    <div className={styles.head}>
                        <span className={`${styles.badge} ${halt.lifted_at ? styles.dashed : ''}`}>
                            {halt.lifted_at ? 'Encerrada' : 'Vigente'}
                        </span>
                        <span className={styles.scope}>{scopeLabel(halt)}</span>
                        {onLift && !halt.lifted_at && (
                            <button type="button" className={styles.lift} disabled={liftingId === halt.id} onClick={() => onLift(halt)}>
                                Retomar
                            </button>
                        )}
                    </div>
                    <p className={styles.reason}>Motivo: {halt.reason}</p>
                    <p className={styles.meta}>
                        Desde {formatDateTime(halt.created_at)}
                        {halt.lifted_at ? `, retomada em ${formatDateTime(halt.lifted_at)}` : ''}
                    </p>
                </li>
            ))}
        </ul>
    )
}
