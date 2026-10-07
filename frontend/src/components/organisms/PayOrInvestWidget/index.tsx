import { useState } from 'react'
import { payOrInvest } from '../../../features/lessons/widgets/debtMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { PayOrInvestWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { PayOrInvestWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

// Widget `pay-or-invest` (RC.4.5): compara a taxa da dívida (levada para o ano) com o que o
// investimento rende líquido de imposto, e diz o que costuma compensar. O veredito é uma regra
// geral: dívida mais cara que o rendimento líquido deve ser quitada primeiro.
export function PayOrInvestWidget(props: PayOrInvestWidgetProps) {
    const [debtRate, setDebtRate] = useState(props.debtMonthlyPct)
    const [invest, setInvest] = useState(props.investAnnualPct)
    const [ir, setIr] = useState(props.irPct)

    const result = payOrInvest({ amount: props.amount, debtMonthlyPct: debtRate, investAnnualPct: invest, irPct: ir })

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Juros da dívida: {pct(debtRate)} ao mês
                    <input
                        type="range"
                        min={0.5}
                        max={16}
                        step={0.5}
                        value={debtRate}
                        onChange={(e) => setDebtRate(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Rendimento do investimento: {pct(invest)} ao ano
                    <input type="range" min={4} max={20} step={0.5} value={invest} onChange={(e) => setInvest(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Imposto sobre o rendimento: {pct(ir)}
                    <input type="range" min={0} max={22.5} step={2.5} value={ir} onChange={(e) => setIr(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {result.verdict === 'pay-debt'
                        ? 'Quitar a dívida primeiro costuma compensar.'
                        : result.verdict === 'invest'
                          ? 'Aqui o investimento rende mais do que a dívida custa.'
                          : 'Dívida e investimento empatam.'}
                </p>
                <p>
                    A dívida custa {pct(result.debtAnnualPct)} ao ano. O investimento rende {pct(result.investNetAnnualPct)} ao ano depois
                    do imposto.
                </p>
                <p>
                    Em 12 meses, {formatCurrency(props.amount)} viram {formatCurrency(result.debtAfterYear)} de dívida ou{' '}
                    {formatCurrency(result.investedAfterYear)} investidos.
                </p>
            </div>
        </div>
    )
}

export function payOrInvestSummary({ amount }: PayOrInvestWidgetProps): string {
    return `Comparador entre quitar a dívida e investir: você ajusta os juros ao mês da dívida, o rendimento anual e o imposto, e vê as duas taxas em ano, quanto ${formatCurrency(amount)} viram em 12 meses de cada lado e o veredito.`
}
