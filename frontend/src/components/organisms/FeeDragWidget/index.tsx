import { useMemo, useState } from 'react'
import { compareFeeDrag } from '../../../features/lessons/widgets/feeDragMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { FeeDragWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'
import chart from './index.module.css'

export type { FeeDragWidgetProps } from './types'

const WIDTH = 320
const HEIGHT = 160
const PAD = 8

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`
const pct1 = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

// Widget `fee-drag` (RC.4.8): dois produtos com o mesmo retorno bruto e taxas
// diferentes. A curva de cima (sólida) é a de menor taxa e a de baixo
// (tracejada) a de maior; a diferença final sai escrita em reais e em %, então
// a leitura não depende da cor.
export function FeeDragWidget({ initial, monthly, grossReturnPct, feeAPct, feeBPct, years }: FeeDragWidgetProps) {
    const [feeA, setFeeA] = useState(feeAPct)
    const [feeB, setFeeB] = useState(feeBPct)
    const [period, setPeriod] = useState(years)
    const [gross, setGross] = useState(grossReturnPct)

    const result = useMemo(
        () => compareFeeDrag({ initial, monthly, grossReturnPct: gross, years: period }, feeA, feeB),
        [initial, monthly, gross, period, feeA, feeB],
    )

    const max = Math.max(...result.a.points.map((p) => p.total), ...result.b.points.map((p) => p.total), 1)
    const toPath = (points: { year: number; total: number }[]) =>
        points
            .map((p) => {
                const x = PAD + (p.year / period) * (WIDTH - PAD * 2)
                const y = HEIGHT - PAD - (p.total / max) * (HEIGHT - PAD * 2)
                return `${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(' ')

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Retorno bruto: {pct(gross)} ao ano
                    <input type="range" min={2} max={16} step={0.5} value={gross} onChange={(e) => setGross(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Taxa do produto A: {pct(feeA)} ao ano
                    <input type="range" min={0} max={4} step={0.1} value={feeA} onChange={(e) => setFeeA(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Taxa do produto B: {pct(feeB)} ao ano
                    <input type="range" min={0} max={4} step={0.1} value={feeB} onChange={(e) => setFeeB(Number(e.target.value))} />
                </label>
            </div>
            <label className={styles.field}>
                Prazo: {period} anos
                <input type="range" min={1} max={40} step={1} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
            </label>
            <svg className={chart.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Evolução do saldo dos dois produtos">
                <line className={chart.axis} x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
                <polyline className={chart.lineA} points={toPath(result.a.points)} />
                <polyline className={chart.lineB} points={toPath(result.b.points)} />
            </svg>
            <ul className={chart.legend}>
                <li>Linha sólida: produto A (taxa de {pct(feeA)})</li>
                <li>Linha tracejada: produto B (taxa de {pct(feeB)})</li>
            </ul>
            <div className={styles.result} aria-live="polite">
                <p>
                    Produto A termina com {formatCurrency(result.a.finalValue)} e o B com {formatCurrency(result.b.finalValue)}, de{' '}
                    {formatCurrency(result.a.invested)} investidos.
                </p>
                <p className={styles.headline}>
                    {result.differenceBRL > 0.005
                        ? `A taxa maior custa ${formatCurrency(result.differenceBRL)} em ${period} anos, ou ${pct1(result.differencePct)} do saldo final.`
                        : result.differenceBRL < -0.005
                          ? `Aqui a taxa menor é a do produto B, que termina ${formatCurrency(-result.differenceBRL)} na frente.`
                          : 'Com taxas iguais, os dois terminam com o mesmo saldo.'}
                </p>
                {result.differenceBRL > 0.005 && <p>Isso consome {pct1(result.gainShareLostPct)} do ganho do produto A.</p>}
            </div>
        </div>
    )
}

export function feeDragSummary({ initial, monthly, grossReturnPct, feeAPct, feeBPct, years }: FeeDragWidgetProps): string {
    return `Comparação de dois produtos com retorno bruto de ${pct(grossReturnPct)} ao ano e taxas de ${pct(feeAPct)} e ${pct(feeBPct)}, com capital inicial de ${formatCurrency(initial)}, aporte mensal de ${formatCurrency(monthly)} e prazo de ${years} anos, com a diferença final em reais e em porcentagem.`
}
