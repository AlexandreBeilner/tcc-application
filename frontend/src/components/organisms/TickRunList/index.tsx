import { formatDateTime, formatDuration } from '../../../features/admin/timeFormat'
import type { TickTrigger } from '../../../services/admin'
import type { TickRunListProps } from './types'
import styles from './index.module.css'

export type { TickRunListProps } from './types'

const TRIGGER_LABELS: Record<TickTrigger, string> = {
    scheduled: 'Agendado',
    catchup: 'Recuperação',
    manual: 'Manual',
}

// Linha do tempo de ticks (N.6), mais recente primeiro. Falha usa a convenção
// tracejado/sólido do app (§3): selo tracejado com o motivo, nunca só cor. O
// descarte do `max_catch_up` aparece no próprio tick que recuperou os atrasados.
export function TickRunList({ ticks }: TickRunListProps) {
    if (ticks.length === 0) {
        return <p className={styles.empty}>Nenhum tick registrado ainda.</p>
    }

    return (
        <ul className={styles.list}>
            {ticks.map((tick) => {
                const failed = tick.status === 'failed'

                return (
                    <li key={`${tick.started_at}-${tick.trigger}-${tick.simulated_day ?? 'x'}`}>
                        <details className={styles.item}>
                            <summary className={styles.summary}>
                                <span className={`${styles.badge} ${failed ? styles.failed : styles.success}`}>
                                    {failed ? 'Falha' : 'Sucesso'}
                                </span>
                                <span className={styles.day}>{tick.simulated_day === null ? 'Sem dia' : `Dia ${tick.simulated_day}`}</span>
                                <span className={styles.trigger}>{TRIGGER_LABELS[tick.trigger]}</span>
                                <span className={styles.date}>{formatDateTime(tick.started_at)}</span>
                                <span className={styles.duration}>{formatDuration(tick.duration_ms)}</span>
                            </summary>

                            <div className={styles.details}>
                                {failed && tick.error_message && <p className={styles.errorMessage}>Motivo: {tick.error_message}</p>}
                                {tick.catch_up_discarded > 0 && (
                                    <p className={styles.warning}>
                                        {tick.catch_up_discarded} tick(s) atrasado(s) descartado(s) pelo limite de recuperação.
                                    </p>
                                )}
                                {!failed && (
                                    <dl className={`${styles.counters} tabular-nums`}>
                                        <div>
                                            <dt>Cotações</dt>
                                            <dd>{tick.quotes_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Rodadas</dt>
                                            <dd>{tick.intraday_rounds_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Negócios de bots</dt>
                                            <dd>{tick.bot_fills_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Ordens expiradas</dt>
                                            <dd>{tick.expired_orders_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Fundamentos</dt>
                                            <dd>{tick.fundamentals_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Proventos gerados / pagos</dt>
                                            <dd>
                                                {tick.dividends_generated_count} / {tick.dividends_paid_count}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Ativos sem cobertura</dt>
                                            <dd>{tick.uncovered_assets_count}</dd>
                                        </div>
                                        <div>
                                            <dt>Selic</dt>
                                            <dd>{tick.selic_rate === null ? '—' : `${tick.selic_rate.toFixed(2).replace('.', ',')}%`}</dd>
                                        </div>
                                    </dl>
                                )}
                                {(tick.is_copom_day || tick.is_report_day) && (
                                    <p className={styles.flags}>
                                        {tick.is_copom_day && 'Dia de Copom. '}
                                        {tick.is_report_day && 'Dia de relatório.'}
                                    </p>
                                )}
                            </div>
                        </details>
                    </li>
                )
            })}
        </ul>
    )
}
