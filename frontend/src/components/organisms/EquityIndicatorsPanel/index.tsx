import { formatDecimal } from '../../../features/market/format'
import { formatPercentage } from '../../../features/portfolio/format'
import type { EquityIndicatorsPanelProps } from './types'
import styles from './index.module.css'

export type { EquityIndicatorsPanelProps } from './types'

// Indicadores de Ação (RF21, tela 4.5) — layout próprio, nunca reaproveitado
// por ETF/FII (CLAUDE.md). Cada um dos 9 campos aparece só se o motor o
// calculou (`.docs/engine/catalog.md`: "cada campo fica omitido
// independentemente dos demais") — sem indicadores nenhum, o painel some
// inteiro (empresa sem ciclo de relatório ainda).
export function EquityIndicatorsPanel({ indicators }: EquityIndicatorsPanelProps) {
    if (!indicators) return null

    const candidates: { label: string; value?: number; format: (value: number) => string }[] = [
        { label: 'P/L', value: indicators.price_to_earnings, format: formatDecimal },
        { label: 'P/VP', value: indicators.price_to_book_value, format: formatDecimal },
        { label: 'LPA', value: indicators.earnings_per_share, format: formatDecimal },
        { label: 'VPA', value: indicators.book_value_per_share, format: formatDecimal },
        { label: 'ROE', value: indicators.roe, format: formatPercentage },
        { label: 'Margem EBIT', value: indicators.ebit_margin, format: formatPercentage },
        { label: 'Margem Líquida', value: indicators.net_margin, format: formatPercentage },
        { label: 'Dívida Líquida/EBIT', value: indicators.net_debt_to_ebit, format: formatDecimal },
        { label: 'Dividend Yield', value: indicators.dividend_yield, format: formatPercentage },
    ]
    const items = candidates.flatMap((candidate) => (candidate.value === undefined ? [] : [{ ...candidate, value: candidate.value }]))

    if (items.length === 0) return null

    return (
        <section className={styles.panel}>
            <span className={styles.title}>Indicadores</span>
            <div className={styles.grid}>
                {items.map((item) => (
                    <div key={item.label} className={styles.item}>
                        <div className={styles.label}>{item.label}</div>
                        <div className={`${styles.value} tabular-nums`}>{item.format(item.value)}</div>
                    </div>
                ))}
            </div>
        </section>
    )
}
