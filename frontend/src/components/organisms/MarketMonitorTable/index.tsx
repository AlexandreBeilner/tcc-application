import { Link } from 'react-router-dom'
import { formatIndicatorValue, indicatorLabel, TYPE_LABELS, type MonitorSortKey } from '../../../features/admin/marketMonitor'
import { formatSignedPercent } from '../../../features/market/format'
import { formatCurrency } from '../../../features/portfolio/format'
import type { MonitorAsset } from '../../../services/admin'
import type { MarketMonitorTableProps } from './types'
import styles from './index.module.css'

export type { MarketMonitorTableProps } from './types'

const integerFormatter = new Intl.NumberFormat('pt-BR')
const MISSING = '—'

function price(value: number | null): string {
    return value === null ? MISSING : formatCurrency(value)
}

function change(value: number | null): { text: string; className: string } {
    if (value === null) return { text: MISSING, className: '' }
    return { text: formatSignedPercent(value), className: value > 0 ? styles.gain : value < 0 ? styles.loss : '' }
}

function book(asset: MonitorAsset): string {
    if (asset.best_bid === null && asset.best_ask === null) return 'Sem ofertas'
    const spread = asset.spread_pct === null ? '' : ` (${asset.spread_pct.toFixed(1).replace('.', ',')}%)`
    return `${price(asset.best_bid)} / ${price(asset.best_ask)}${spread}`
}

function float(asset: MonitorAsset): string {
    const shares = asset.outstanding_shares === null ? MISSING : integerFormatter.format(asset.outstanding_shares)
    return `${shares} | bots ${integerFormatter.format(asset.held_by_bots)} | usuários ${integerFormatter.format(asset.held_by_users)}`
}

const COLUMNS: Array<{ key: MonitorSortKey | null; header: string }> = [
    { key: 'ticker', header: 'Ativo' },
    { key: 'last_price', header: 'Último' },
    { key: 'daily_change_pct', header: 'Variação' },
    { key: 'spread_pct', header: 'Compra / venda (spread)' },
    { key: 'resting_orders', header: 'Ordens abertas' },
    { key: 'day_volume', header: 'Negociado no dia' },
    { key: null, header: 'Cotas: total | bots | usuários' },
    { key: null, header: 'Indicador' },
]

// Monitor de mercado (N.8): tabela no tablet/desktop e cartões no mobile (nunca tabela com
// scroll horizontal em tela estreita). Os dois markups existem no DOM e o CSS escolhe.
// Ordenação nos cabeçalhos; cada linha leva ao detalhe do ativo.
export function MarketMonitorTable({ assets, sortKey, sortDirection, onSort, emptyMessage }: MarketMonitorTableProps) {
    if (assets.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

    const detailPath = (asset: MonitorAsset) => `/admin/mercado/ativos/${asset.asset_id}`

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {COLUMNS.map(({ key, header }) => (
                            <th
                                key={header}
                                className={styles.th}
                                aria-sort={
                                    key !== null && key === sortKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                                }
                            >
                                {key === null ? (
                                    header
                                ) : (
                                    <button type="button" className={styles.sortButton} onClick={() => onSort(key)}>
                                        {header}
                                        {key === sortKey && <span aria-hidden="true">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>}
                                    </button>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {assets.map((asset) => {
                        const delta = change(asset.daily_change_pct)
                        return (
                            <tr key={asset.asset_id} className={styles.tr}>
                                <td className={styles.td}>
                                    <Link to={detailPath(asset)} className={styles.ticker}>
                                        {asset.ticker}
                                    </Link>
                                    <div className={styles.sub}>
                                        {TYPE_LABELS[asset.type]}
                                        {asset.sector ? `, ${asset.sector}` : ''}
                                    </div>
                                    {!asset.covered && <div className={styles.uncovered}>Sem Market Maker</div>}
                                </td>
                                <td className={styles.td}>{price(asset.last_price)}</td>
                                <td className={`${styles.td} ${delta.className}`}>{delta.text}</td>
                                <td className={styles.td}>{book(asset)}</td>
                                <td className={styles.td}>
                                    {asset.resting_orders}
                                    <div className={styles.sub}>{asset.bot_resting_orders} de bots</div>
                                </td>
                                <td className={styles.td}>
                                    {integerFormatter.format(asset.day_volume)} cotas
                                    <div className={styles.sub}>{asset.day_trades} negócios</div>
                                </td>
                                <td className={styles.td}>{float(asset)}</td>
                                <td className={styles.td}>
                                    {asset.indicator ? (
                                        <>
                                            {formatIndicatorValue(asset.indicator)}
                                            <div className={styles.sub}>{indicatorLabel(asset.indicator)}</div>
                                        </>
                                    ) : (
                                        MISSING
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {assets.map((asset) => {
                    const delta = change(asset.daily_change_pct)
                    return (
                        <li key={asset.asset_id}>
                            <Link to={detailPath(asset)} className={styles.card}>
                                <div className={styles.cardHead}>
                                    <span className={styles.ticker}>{asset.ticker}</span>
                                    <span className={styles.sub}>{TYPE_LABELS[asset.type]}</span>
                                    {!asset.covered && <span className={styles.uncovered}>Sem Market Maker</span>}
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Último</span>
                                    <span>
                                        {price(asset.last_price)} <span className={delta.className}>{delta.text}</span>
                                    </span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Compra / venda</span>
                                    <span>{book(asset)}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Ordens abertas</span>
                                    <span>
                                        {asset.resting_orders} ({asset.bot_resting_orders} de bots)
                                    </span>
                                </div>
                                {asset.indicator && (
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>{indicatorLabel(asset.indicator)}</span>
                                        <span>{formatIndicatorValue(asset.indicator)}</span>
                                    </div>
                                )}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
