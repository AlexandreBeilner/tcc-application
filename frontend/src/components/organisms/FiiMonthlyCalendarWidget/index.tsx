import { useState } from 'react'
import { MONTH_NAMES, fiiMonthLabels, fiiYearSummary } from '../../../features/lessons/widgets/proventosMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { FiiMonthlyCalendarWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { FiiMonthlyCalendarWidgetProps } from './types'

const SHORT = MONTH_NAMES.map((name) => name.slice(0, 3))

// Widget `fii-monthly-calendar` (RC.3.4g): os 12 meses de rendimentos de um FII. O fundo paga todo
// mês o valor por cota; cada mês tem data com (último dia útil), data ex (1º dia útil do mês seguinte)
// e pagamento (no dia útil que o fundo define, em geral entre o 5º e o 15º). Escolher o mês mostra os
// três marcos. O rendimento do FII para pessoa física é isento quando o fundo atende às regras da lei.
export function FiiMonthlyCalendarWidget({ monthlyPerShare, shares, price, payoutBusinessDay }: FiiMonthlyCalendarWidgetProps) {
    const [payDay, setPayDay] = useState(payoutBusinessDay)
    const [month, setMonth] = useState(0)

    const year = fiiYearSummary(monthlyPerShare, shares, price)
    const labels = fiiMonthLabels(month, payDay)
    const monthTotal = monthlyPerShare * shares

    return (
        <div className={styles.root}>
            <label className={styles.field}>
                Dia útil de pagamento do fundo: {payDay}º
                <input type="range" min={5} max={15} step={1} value={payDay} onChange={(e) => setPayDay(Number(e.target.value))} />
            </label>
            <ol className={styles.timeline} aria-label="Meses do ano">
                {SHORT.map((name, index) => (
                    <li key={name}>
                        <button
                            type="button"
                            className={styles.timelineMark}
                            aria-pressed={month === index}
                            onClick={() => setMonth(index)}
                        >
                            {name}
                        </button>
                    </li>
                ))}
            </ol>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Rendimento de {MONTH_NAMES[month]}: {formatCurrency(monthTotal)} ({formatCurrency(monthlyPerShare)} por cota, {shares}{' '}
                    cotas).
                </p>
                <p>Data com: {labels.com}. Quem tem a cota no fim desse dia tem o direito.</p>
                <p>Data ex: {labels.ex}. A cota passa a ser negociada sem o rendimento.</p>
                <p>Pagamento: {labels.pay}.</p>
                <p>
                    No ano são 12 pagamentos, {formatCurrency(year.annualTotal)} no total, ou{' '}
                    {year.dividendYieldPct.toFixed(1).replace('.', ',')}% ao ano sobre a cota de {formatCurrency(price)}.
                </p>
                <p>
                    Para pessoa física o rendimento do FII é isento de IR quando o fundo tem pelo menos 100 cotistas, as cotas são
                    negociadas em bolsa e você tem menos de 10% delas. O ganho na venda da cota é tributado à parte.
                </p>
            </div>
        </div>
    )
}

export function fiiMonthlyCalendarSummary({ monthlyPerShare, shares }: FiiMonthlyCalendarWidgetProps): string {
    return `Calendário de 12 meses de rendimentos de um FII com ${shares} cotas pagando ${formatCurrency(monthlyPerShare)} por cota: em cada mês, a data com, a data ex e o dia útil do pagamento.`
}
