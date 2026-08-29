import { formatDecimal } from '../../../features/market/format'
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
