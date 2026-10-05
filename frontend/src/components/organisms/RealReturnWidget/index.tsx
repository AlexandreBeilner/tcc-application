import { useState } from 'react'
import { oneYearOutcome, realReturnPct } from '../../../features/lessons/widgets/macroMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { RealReturnWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { RealReturnWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

const BAR_SCALE_MAX = 20

// Widget `real-return` (RC.3.4c): três barras (rendimento nominal, inflação e
// rendimento real) e um controle de inflação. O valor sai escrito em cada barra,
// então a leitura não depende de cor nem de comprimento.
export function RealReturnWidget({ nominalPct, inflationPct, amount }: RealReturnWidgetProps) {
    const [nominal, setNominal] = useState(nominalPct)
    const [inflation, setInflation] = useState(inflationPct)

    const real = realReturnPct(nominal, inflation)
    const { nominal: nominalValue, inTodaysMoney } = oneYearOutcome(amount, nominal, inflation)
    const bars = [
        { label: 'Rendimento nominal', value: nominal },
        { label: 'Inflação (IPCA)', value: inflation },
        { label: 'Rendimento real', value: real },
    ]

    return (
        <div className={styles.root}>
            <label className={styles.field}>
                Rendimento nominal: {pct(nominal)} ao ano
                <input
                    type="range"
                    min={0}
                    max={BAR_SCALE_MAX}
                    step={0.25}
                    value={nominal}
                    onChange={(e) => setNominal(Number(e.target.value))}
                />
            </label>
            <label className={styles.field}>
                Inflação: {pct(inflation)} ao ano
                <input
                    type="range"
                    min={0}
                    max={BAR_SCALE_MAX}
                    step={0.25}
                    value={inflation}
                    onChange={(e) => setInflation(Number(e.target.value))}
                />
            </label>
            <ul className={styles.bars} aria-label="Comparação de rendimento nominal, inflação e rendimento real">
                {bars.map((bar) => (
                    <li key={bar.label} className={styles.barRow}>
                        <span className={styles.barLabel}>{bar.label}</span>
                        <span className={styles.barTrack}>
                            <span
                                className={bar.value < 0 ? styles.barFillNegative : styles.barFill}
                                style={{ width: `${Math.min(100, (Math.abs(bar.value) / BAR_SCALE_MAX) * 100)}%` }}
                            />
                        </span>
                        <span className={styles.barValue}>{pct(bar.value)}</span>
                    </li>
                ))}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p>
                    {formatCurrency(amount)} viram {formatCurrency(nominalValue)} em um ano, em reais de então.
                </p>
                <p className={styles.headline}>Em reais de hoje, isso compra o equivalente a {formatCurrency(inTodaysMoney)}.</p>
                <p>
                    {real > 0
                        ? `Você ganhou ${pct(real)} de poder de compra.`
                        : real < 0
                          ? `Você perdeu ${pct(Math.abs(real))} de poder de compra, mesmo com o saldo crescendo.`
                          : 'O saldo cresceu, mas o poder de compra ficou igual.'}
                </p>
            </div>
        </div>
    )
}

export function realReturnSummary({ nominalPct, inflationPct }: RealReturnWidgetProps): string {
    return `Comparação entre um rendimento nominal de ${pct(nominalPct)}, uma inflação de ${pct(inflationPct)} e o rendimento real que sobra, com os dois primeiros ajustáveis.`
}
