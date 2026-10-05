import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MonitorBookPanel } from '../../components/organisms/MonitorBookPanel'
import { PriceChart } from '../../components/organisms/PriceChart'
import { formatIndicatorValue, indicatorLabel, TYPE_LABELS } from '../../features/admin/marketMonitor'
import { useMarketMonitorAssetQuery } from '../../features/admin/useMarketMonitorAssetQuery'
import { formatDecimal, formatSignedPercent } from '../../features/market/format'
import { formatCurrency } from '../../features/portfolio/format'
import { ApiError } from '../../services/client'
import styles from './index.module.css'

const RANGES = [
    { days: 30, label: '30D' },
    { days: 60, label: '60D' },
]

const integerFormatter = new Intl.NumberFormat('pt-BR')

// Tela 10.7 (N.8) — detalhe de um ativo no monitor: book completo com a parcela de bots,
// últimos negócios, série de cotações e, pra ETF, a série de NAV com o ágio. Só leitura.
export function AdminMercadoAtivo() {
    const { id } = useParams<{ id: string }>()
    const query = useMarketMonitorAssetQuery(id)
    const [rangeDays, setRangeDays] = useState(RANGES[0].days)

    const quotes = useMemo(() => (query.data ? query.data.quotes.slice(-rangeDays) : []), [query.data, rangeDays])

    if (query.isError) {
        const notFound = query.error instanceof ApiError && query.error.status === 404
        return (
            <main className={styles.page}>
                <Link to="/admin/mercado" className={styles.back}>
                    Voltar ao mercado
                </Link>
                <p className={styles.error} role="alert">
                    {notFound ? 'Ativo não encontrado ou fora do universo negociável.' : 'Não foi possível carregar o ativo agora.'}
                </p>
            </main>
        )
    }

    if (!query.data) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando o ativo…</p>
            </main>
        )
    }

    const asset = query.data
    const delta = asset.daily_change_pct
    const free = asset.outstanding_shares === null ? null : asset.outstanding_shares - asset.held_by_bots - asset.held_by_users

    return (
        <main className={styles.page}>
            <Link to="/admin/mercado" className={styles.back}>
                Voltar ao mercado
            </Link>

            <header className={styles.header}>
                <h1 className={styles.title}>
                    {asset.ticker} <span className={styles.name}>{asset.name}</span>
                </h1>
                <p className={styles.meta}>
                    {TYPE_LABELS[asset.type]}
                    {asset.sector ? `, ${asset.sector}` : ''}
                </p>
                {!asset.covered && (
                    <p className={styles.warning} role="status">
                        Sem Market Maker ativo cobrindo este ativo.
                    </p>
                )}
                <Link to={`/admin/mercado/ordens?asset_id=${asset.asset_id}`} className={styles.back}>
                    Ver e cancelar ordens deste ativo
                </Link>
            </header>

            <dl className={styles.facts}>
                <div>
                    <dt>Último negócio</dt>
                    <dd>
                        {asset.last_price === null ? '—' : formatCurrency(asset.last_price)}
                        {delta !== null && (
                            <span className={delta > 0 ? styles.gain : delta < 0 ? styles.loss : ''}> {formatSignedPercent(delta)}</span>
                        )}
                    </dd>
                </div>
                <div>
                    <dt>Melhor compra / venda</dt>
                    <dd>
                        {asset.best_bid === null ? '—' : formatCurrency(asset.best_bid)} /{' '}
                        {asset.best_ask === null ? '—' : formatCurrency(asset.best_ask)}
                        {asset.spread_pct !== null && ` (${formatDecimal(asset.spread_pct)}%)`}
                    </dd>
                </div>
                <div>
                    <dt>Negociado no dia</dt>
                    <dd>
                        {integerFormatter.format(asset.day_volume)} cotas, {asset.day_trades} negócios
                    </dd>
                </div>
                <div>
                    <dt>Ordens abertas</dt>
                    <dd>
                        {asset.resting_orders}, {asset.bot_resting_orders} de bots
                    </dd>
                </div>
                <div>
                    <dt>Cotas em circulação</dt>
                    <dd>{asset.outstanding_shares === null ? '—' : integerFormatter.format(asset.outstanding_shares)}</dd>
                </div>
                <div>
                    <dt>Com bots / com usuários / livres</dt>
                    <dd>
                        {integerFormatter.format(asset.held_by_bots)} / {integerFormatter.format(asset.held_by_users)} /{' '}
                        {free === null ? '—' : integerFormatter.format(free)}
                    </dd>
                </div>
                {asset.indicator && (
                    <div>
                        <dt>{indicatorLabel(asset.indicator)}</dt>
                        <dd>{formatIndicatorValue(asset.indicator)}</dd>
                    </div>
                )}
            </dl>

            <div className={styles.columns}>
                <MonitorBookPanel asks={asset.asks} bids={asset.bids} trades={asset.trades} />

                <div className={styles.side}>
                    <PriceChart quotes={quotes} ranges={RANGES} activeDays={rangeDays} onRangeChange={setRangeDays} />

                    {asset.type === 'etf' && (
                        <section className={styles.nav} aria-label="NAV do ETF">
                            <h2 className={styles.sectionTitle}>NAV e ágio/deságio</h2>
                            {asset.nav_history.length === 0 ? (
                                <p className={styles.loading}>Sem NAV gravado ainda.</p>
                            ) : (
                                <table className={styles.navTable}>
                                    <thead>
                                        <tr>
                                            <th>Dia simulado</th>
                                            <th>NAV</th>
                                            <th>Fechamento</th>
                                            <th>Ágio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...asset.nav_history]
                                            .reverse()
                                            .slice(0, 10)
                                            .map((point) => (
                                                <tr key={point.simulated_day}>
                                                    <td>{point.simulated_day}</td>
                                                    <td>{formatCurrency(point.nav)}</td>
                                                    <td>{formatCurrency(point.close_price)}</td>
                                                    <td>{formatSignedPercent(point.premium_pct)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </main>
    )
}
