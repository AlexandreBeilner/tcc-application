import { AUDIT_ACTION_LABELS, AUDIT_RESULT_LABELS } from '../../../features/admin/auditLabels'
import type { AuditLogListProps } from './types'
import styles from './index.module.css'

export type { AuditLogListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
})

// Tela 10.4 (N.4) — linha por ação administrativa, mesmo molde expansível de
// `MacroEventHistoryList`. Falha usa a convenção tracejado/sólido do app
// (identidade-visual-padroes.md §3): o selo de falha é tracejado e traz a
// mensagem, nunca só a cor. O payload é a entrada da ação em JSON, sem dado
// sensível (garantido no backend).
export function AuditLogList({ entries }: AuditLogListProps) {
    if (entries.length === 0) {
        return <p className={styles.empty}>Nenhuma ação administrativa registrada para esse filtro.</p>
    }

    return (
        <ul className={styles.list}>
            {entries.map((entry) => {
                const failed = entry.result === 'failed'

                return (
                    <li key={entry.id}>
                        <details className={styles.item}>
                            <summary className={styles.summary}>
                                <span className={`${styles.badge} ${failed ? styles.failed : styles.success}`}>
                                    {AUDIT_RESULT_LABELS[entry.result]}
                                </span>
                                <span className={styles.action}>{AUDIT_ACTION_LABELS[entry.action]}</span>
                                <span className={styles.admin}>{entry.admin_username ?? 'admin removido'}</span>
                                <span className={styles.date}>{dateFormatter.format(new Date(entry.occurred_at))}</span>
                            </summary>

                            <div className={styles.details}>
                                {failed && entry.error_message && <p className={styles.errorMessage}>Motivo: {entry.error_message}</p>}
                                <div className={styles.meta}>
                                    <span>Alvo: {entry.target_type}</span>
                                    {entry.target_id && <span>Id: {entry.target_id}</span>}
                                </div>
                                <pre className={styles.payload}>{JSON.stringify(entry.payload, null, 2)}</pre>
                            </div>
                        </details>
                    </li>
                )
            })}
        </ul>
    )
}
