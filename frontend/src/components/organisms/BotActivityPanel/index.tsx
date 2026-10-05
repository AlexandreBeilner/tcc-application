import { Select } from '../../atoms/Select'
import type { SelectOption } from '../../atoms/Select'
import { describeCancelReason } from '../../../features/admin/adminOrders'
import { formatDateTime } from '../../../features/admin/timeFormat'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BotActivityPanelProps } from './types'
import styles from './index.module.css'

export type { BotActivityPanelProps } from './types'

const ACTIVITY_DAYS_OPTIONS: SelectOption[] = [
    { value: '7', label: 'Últimos 7 dias' },
    { value: '30', label: 'Últimos 30 dias' },
    { value: '90', label: 'Últimos 90 dias' },
]

const numberFormatter = new Intl.NumberFormat('pt-BR')
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

function percent(value: number | null): string {
    return value === null ? 'Sem base' : `${decimalFormatter.format(value)}%`
}

function price(value: number | null): string {
    return value === null ? 'Sem ordem' : formatCurrency(value)
}

// Sinal explícito: ganho e perda nunca dependem só da cor.
function signedCurrency(value: number): string {
    return `${value > 0 ? '+' : ''}${formatCurrency(value)}`
}

// Desempenho de um bot (N.14). Patrimônio, capital e P&L são acumulados desde a criação; ordens,
// negócios e volume respeitam a janela escolhida. No Market Maker, mostra a situação atual da
// cotação por ativo (o book não guarda quando uma ordem terminou, então não há histórico de
// tempo de cotação).
export function BotActivityPanel({ activity, isLoading, isError, days, onDaysChange }: BotActivityPanelProps) {
    if (isError) {
        return (
            <p className={styles.error} role="alert">
                Não foi possível carregar o desempenho deste bot agora.
            </p>
        )
    }
    if (isLoading || !activity) return <p className={styles.loading}>Carregando desempenho…</p>

    const { orders } = activity
    const reasons = Object.entries(orders.cancelled_by_reason)

    return (
        <section className={styles.panel} aria-label="Desempenho do bot">
            <header className={styles.header}>
                <h3 className={styles.title}>Desempenho</h3>
                <Select
                    aria-label="Janela do desempenho"
                    value={String(days)}
                    options={ACTIVITY_DAYS_OPTIONS}
                    onChange={(value) => onDaysChange(Number(value))}
                />
            </header>

            <div className={styles.group}>
                <h4 className={styles.groupTitle}>Resultado, desde a criação</h4>
                <dl className={styles.facts}>
                    <div className={styles.fact}>
                        <dt>Patrimônio</dt>
                        <dd>{formatCurrency(activity.net_worth)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Capital aportado</dt>
                        <dd>{formatCurrency(activity.capital_contributed)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Resultado (P&amp;L)</dt>
                        <dd>
                            {signedCurrency(activity.pnl)} (
                            {activity.pnl_pct === null ? 'sem base' : `${activity.pnl > 0 ? '+' : ''}${percent(activity.pnl_pct)}`})
                        </dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Caixa</dt>
                        <dd>{formatCurrency(activity.cash)}</dd>
                    </div>
                </dl>
            </div>

            <div className={styles.group}>
                <h4 className={styles.groupTitle}>
                    Atividade, dias simulados {activity.from_day} a {activity.to_day}
                </h4>
                <dl className={styles.facts}>
                    <div className={styles.fact}>
                        <dt>Ordens enviadas</dt>
                        <dd>{numberFormatter.format(orders.sent)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Executadas</dt>
                        <dd>{numberFormatter.format(orders.filled)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Em aberto</dt>
                        <dd>{numberFormatter.format(orders.open)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Canceladas</dt>
                        <dd>{numberFormatter.format(orders.cancelled)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Taxa de execução</dt>
                        <dd>{percent(orders.fill_rate_pct)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Negócios</dt>
                        <dd>{numberFormatter.format(activity.trades)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Volume negociado</dt>
                        <dd>{formatCurrency(activity.volume)}</dd>
                    </div>
                    <div className={styles.fact}>
                        <dt>Última ordem</dt>
                        <dd>
                            {activity.last_order_at === null
                                ? 'Nunca enviou'
                                : `${formatDateTime(activity.last_order_at)} (dia ${activity.last_order_day})`}
                        </dd>
                    </div>
                </dl>
                {reasons.length > 0 && (
                    <p className={styles.reasons}>
                        Canceladas por motivo:{' '}
                        {reasons.map(([reason, count]) => `${describeCancelReason(reason)} (${numberFormatter.format(count)})`).join(', ')}.
                    </p>
                )}
            </div>

            {activity.quotes.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>Cotação atual por ativo coberto</h4>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {['Ativo', 'Compra', 'Venda', 'Spread', 'Inventário'].map((header) => (
                                    <th key={header} className={styles.th}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {activity.quotes.map((quote) => (
                                <tr key={quote.asset_id}>
                                    <td className={styles.td}>{quote.ticker}</td>
                                    <td className={`${styles.td} tabular-nums`}>{price(quote.best_bid)}</td>
                                    <td className={`${styles.td} tabular-nums`}>{price(quote.best_ask)}</td>
                                    <td className={`${styles.td} tabular-nums`}>
                                        {quote.spread_pct === null ? 'Sem book' : percent(quote.spread_pct)}
                                    </td>
                                    <td className={`${styles.td} tabular-nums`}>
                                        {numberFormatter.format(quote.held_quantity)} de {numberFormatter.format(quote.target_quantity)}
                                        {quote.inventory_pct !== null && ` (${percent(quote.inventory_pct)})`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
