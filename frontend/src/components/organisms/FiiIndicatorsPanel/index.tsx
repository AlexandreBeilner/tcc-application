import { formatRatePercent } from '../../../features/market/format'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import type { FiiIndicatorsPanelProps } from './types'
import styles from './index.module.css'

export type { FiiIndicatorsPanelProps } from './types'

// Especialização de FII (RF21, tela 4.5) — tijolo mostra segmento/
// patrimônio/vacância, papel mostra indexador; os dois mostram Dividend
// Yield e cota/valor patrimonial (CLAUDE.md: nunca reaproveitar o layout
// de indicadores de Ações; `net_worth`/`portfolio_value` são a mesma
// grandeza numérica sob nomes diferentes por perfil, `.docs/engine/
// catalog.md`). `vacancy_rate` chega em pontos percentuais já prontos
// (ex: `5.2` = 5,2%, mesma escala de `fixed_income.interest_rate` —
// `formatRatePercent`), diferente de `dividend_yield` (razão 0–1, mesma
// escala de `roe`/margens — `formatPercentage`).
export function FiiIndicatorsPanel({ fii }: FiiIndicatorsPanelProps) {
    const netWorthPerProfile = fii.fii_type === 'tijolo' ? fii.net_worth : fii.portfolio_value

    return (
        <section className={styles.panel}>
            <span className={styles.title}>{fii.fii_type === 'tijolo' ? 'FII de Tijolo' : 'FII de Papel'}</span>

            <div className={styles.grid}>
                {fii.fii_type === 'tijolo' && fii.segment && (
                    <div className={styles.item}>
                        <div className={styles.label}>Segmento</div>
                        <div className={styles.value}>{fii.segment}</div>
                    </div>
                )}
                {fii.fii_type === 'papel' && fii.indexador && (
                    <div className={styles.item}>
                        <div className={styles.label}>Indexador</div>
                        <div className={styles.value}>{fii.indexador}</div>
                    </div>
                )}
                {netWorthPerProfile !== undefined && (
                    <div className={styles.item}>
                        <div className={styles.label}>Patrimônio</div>
                        <div className={`${styles.value} tabular-nums`}>{formatCurrency(netWorthPerProfile)}</div>
                    </div>
                )}
                {fii.fii_type === 'tijolo' && fii.vacancy_rate !== undefined && (
                    <div className={styles.item}>
                        <div className={styles.label}>Taxa de vacância</div>
                        <div className={`${styles.value} tabular-nums`}>{formatRatePercent(fii.vacancy_rate)}</div>
                    </div>
                )}
                {fii.dividend_yield !== undefined && (
                    <div className={styles.item}>
                        <div className={styles.label}>Dividend Yield</div>
                        <div className={`${styles.value} tabular-nums`}>{formatPercentage(fii.dividend_yield)}</div>
                    </div>
                )}
            </div>
        </section>
    )
}
