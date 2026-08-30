import { formatCurrency } from '../../../features/portfolio/format'
import type { CompanyFundamentalsChartProps } from './types'
import styles from './index.module.css'

export type { CompanyFundamentalsChartProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: '2-digit' })

// Série histórica de `company_fundamentals` (tela 4.6) — só `net_revenue`
// existe hoje (`.docs/engine/catalog.md`: "os demais indicadores... ainda
// não têm fórmula de geração"), por isso é a única barra mostrada; o
// inventário pede Receita/EBIT/Lucro Líquido/Patrimônio/Dívida/Caixa, os
// outros 5 ficam pra quando o motor gerar esse dado (fora de escopo desta
// sessão — motor não é tocado de novo depois da semana 4).
export function CompanyFundamentalsChart({ fundamentals }: CompanyFundamentalsChartProps) {
    const withRevenue = fundamentals.filter((entry) => entry.net_revenue !== null)

    if (withRevenue.length === 0) {
        return <p className={styles.empty}>Esta empresa ainda não tem ciclo de relatório suficiente pro gráfico.</p>
    }

    const maxRevenue = Math.max(...withRevenue.map((entry) => entry.net_revenue as number))
    const chronological = [...withRevenue].reverse()

    return (
        <div className={styles.chart}>
            {chronological.map((entry) => {
                const heightPercent = maxRevenue > 0 ? Math.max(4, ((entry.net_revenue as number) / maxRevenue) * 100) : 4
                return (
                    <div key={entry.period_date} className={styles.bar}>
                        <div className={styles.barTrack}>
                            <div
                                className={styles.barFill}
                                style={{ height: `${heightPercent}%` }}
                                title={formatCurrency(entry.net_revenue as number)}
                            />
                        </div>
                        <span className={styles.barLabel}>{dateFormatter.format(new Date(entry.period_date))}</span>
                    </div>
                )
            })}
        </div>
    )
}
