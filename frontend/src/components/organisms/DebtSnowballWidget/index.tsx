import { useMemo, useState } from 'react'
import { annualFromMonthlyPct, simulateDebt } from '../../../features/lessons/widgets/debtMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { DebtSnowballWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'
import chart from './index.module.css'

export type { DebtSnowballWidgetProps } from './types'

const WIDTH = 320
const HEIGHT = 140
const PAD = 8

const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

function monthsLabel(months: number): string {
    const years = Math.floor(months / 12)
    const rest = months % 12
    if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`
    return `${months} meses (${years} ${years === 1 ? 'ano' : 'anos'}${rest > 0 ? ` e ${rest} ${rest === 1 ? 'mês' : 'meses'}` : ''})`
}

// Widget `debt-snowball` (RC.4.5): saldo, taxa ao mês e pagamento mensal. Mostra em quantos
// meses a dívida acaba, quanto se paga de juros e a curva do saldo; quando o pagamento não
// cobre nem os juros do mês, avisa que a dívida só cresce. Os números saem escritos, então a
// leitura não depende da cor.
export function DebtSnowballWidget(props: DebtSnowballWidgetProps) {
    const [balance, setBalance] = useState(props.balance)
    const [rate, setRate] = useState(props.monthlyRatePct)
    const [payment, setPayment] = useState(props.payment)

    const result = useMemo(() => simulateDebt({ balance, monthlyRatePct: rate, payment }), [balance, rate, payment])
    const horizon = result.points[result.points.length - 1].month || 1
    const max = Math.max(...result.points.map((p) => p.balance), 1)
    const path = result.points
        .map((p) => {
            const x = PAD + (p.month / horizon) * (WIDTH - PAD * 2)
            const y = HEIGHT - PAD - (p.balance / max) * (HEIGHT - PAD * 2)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Dívida: {formatCurrency(balance)}
                    <input
                        type="range"
                        min={500}
                        max={50_000}
                        step={500}
                        value={balance}
                        onChange={(e) => setBalance(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Juros: {pct(rate)} ao mês
                    <input type="range" min={0.5} max={16} step={0.5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Pagamento por mês: {formatCurrency(payment)}
                    <input
                        type="range"
                        min={50}
                        max={5000}
                        step={50}
                        value={payment}
                        onChange={(e) => setPayment(Number(e.target.value))}
                    />
                </label>
            </div>
            <svg className={chart.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Saldo da dívida ao longo dos meses">
                <line className={chart.axis} x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
                <polyline className={chart.line} points={path} />
            </svg>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {result.months === null
                        ? `Com ${formatCurrency(payment)} por mês a dívida não diminui: os juros do primeiro mês já são ${formatCurrency(result.firstMonthInterest)}.`
                        : `Você quita em ${monthsLabel(result.months)} e paga ${formatCurrency(result.totalInterest)} só de juros.`}
                </p>
                {result.months !== null && (
                    <p>
                        Total pago: {formatCurrency(result.totalPaid)} para uma dívida de {formatCurrency(balance)}.
                    </p>
                )}
                <p>
                    {pct(rate)} ao mês equivalem a {pct(annualFromMonthlyPct(rate))} ao ano.
                </p>
            </div>
        </div>
    )
}

export function debtSnowballSummary({ balance, monthlyRatePct, payment }: DebtSnowballWidgetProps): string {
    return `Calculadora de dívida: com saldo inicial de ${formatCurrency(balance)}, juros de ${pct(monthlyRatePct)} ao mês e pagamento de ${formatCurrency(payment)} por mês, mostra em quantos meses a dívida acaba, o total de juros e o gráfico do saldo, ou avisa quando o pagamento não cobre os juros.`
}
