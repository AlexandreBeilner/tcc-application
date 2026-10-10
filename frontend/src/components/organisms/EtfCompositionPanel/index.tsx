import { formatDecimal, formatSignedPercent } from '../../../features/market/format'
import { formatCurrency } from '../../../features/portfolio/format'
import type { EtfCompositionPanelProps } from './types'
import styles from './index.module.css'

export type { EtfCompositionPanelProps } from './types'

// Especialização de ETF (RF21, tela 4.5) — índice replicado + metodologia
// + composição sintética, sem nenhum indicador de empresa individual
// (CLAUDE.md: nunca reaproveitar o layout de indicadores de Ações).
export function EtfCompositionPanel({ etf }: EtfCompositionPanelProps) {
    return (
        <section className={styles.panel}>
            <span className={styles.title}>Composição</span>

            <div className={styles.row}>
                <span className={styles.label}>Índice de referência</span>
                <span className={styles.value}>{etf.benchmark_index}</span>
            </div>

            {etf.methodology_summary && <p className={styles.methodology}>{etf.methodology_summary}</p>}

            {etf.nav !== undefined && (
                <div className={styles.metrics}>
                    <div className={styles.row}>
                        <span className={styles.label}>Valor patrimonial (NAV) por cota</span>
                        <span className={`${styles.value} tabular-nums`}>{formatCurrency(etf.nav)}</span>
                    </div>
                    {etf.premium_pct !== undefined && (
                        <div className={styles.row}>
                            <span className={styles.label}>{etf.premium_pct < 0 ? 'Deságio sobre o NAV' : 'Ágio sobre o NAV'}</span>
                            <span className={`${styles.value} tabular-nums`}>{formatSignedPercent(etf.premium_pct)}</span>
                        </div>
                    )}
                    {etf.tracking_error_pct !== undefined && (
                        <div className={styles.row}>
                            <span className={styles.label}>Desvio contra o índice (tracking error)</span>
                            <span className={`${styles.value} tabular-nums`}>{formatSignedPercent(etf.tracking_error_pct)}</span>
                        </div>
                    )}
                    {etf.shares_outstanding !== undefined && (
                        <div className={styles.row}>
                            <span className={styles.label}>Cotas emitidas</span>
                            <span className={`${styles.value} tabular-nums`}>{etf.shares_outstanding.toLocaleString('pt-BR')}</span>
                        </div>
                    )}
                    <p className={styles.methodology}>
                        O NAV é o valor real da cesta dividido pelas cotas. O preço no mercado oscila em torno dele: acima é ágio, abaixo é
                        deságio. Um participante autorizado cria ou resgata cotas quando a diferença fica grande.
                    </p>
                </div>
            )}

            {etf.holdings.length > 0 ? (
                <ul className={styles.holdings}>
                    {etf.holdings.map((holding) => (
                        <li key={holding.constituent_name} className={styles.holding}>
                            <span>{holding.constituent_name}</span>
                            <span className="tabular-nums">{formatDecimal(holding.weight_pct)}%</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.empty}>Composição sintética ainda não cadastrada.</p>
            )}
        </section>
    )
}
