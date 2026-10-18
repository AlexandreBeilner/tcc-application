import { useEffect, useState } from 'react'
import { breakevenInflationPct, breakevenWinner } from '../../../features/lessons/widgets/treasuryMath'
import type { BreakevenInflationWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { BreakevenInflationWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

// Widget `breakeven-inflation` (RC.3.4d): a inflação de equilíbrio entre um
// título prefixado e um IPCA+ de mesmo prazo, e quem ganha para a inflação que o
// aluno espera. Comparação bruta: os dois pagam o mesmo IR no mesmo prazo.
export function BreakevenInflationWidget({ prefixedPct, realPct, expectedInflationPct, onMetrics }: BreakevenInflationWidgetProps) {
    const [prefixed, setPrefixed] = useState(prefixedPct)
    const [real, setReal] = useState(realPct)
    const [expected, setExpected] = useState(expectedInflationPct)

    const breakeven = breakevenInflationPct(prefixed, real)
    const winner = breakevenWinner(expected, breakeven)
    // Pontos de inflação esperada acima do equilíbrio: positivo quando o IPCA+ rende mais.
    const inflationAboveBreakevenPp = expected - breakeven
    useEffect(() => onMetrics?.({ inflationAboveBreakevenPp }), [inflationAboveBreakevenPp, onMetrics])

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Taxa do prefixado: {pct(prefixed)} ao ano
                    <input
                        type="range"
                        min={6}
                        max={18}
                        step={0.25}
                        value={prefixed}
                        onChange={(e) => setPrefixed(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Taxa real do IPCA+: {pct(real)} ao ano
                    <input type="range" min={3} max={10} step={0.25} value={real} onChange={(e) => setReal(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Inflação que você espera: {pct(expected)} ao ano
                    <input
                        type="range"
                        min={0}
                        max={12}
                        step={0.25}
                        value={expected}
                        onChange={(e) => setExpected(Number(e.target.value))}
                    />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>Inflação de equilíbrio: {pct(breakeven)} ao ano.</p>
                <p>É a inflação que deixa os dois títulos empatados: (1 + prefixado) dividido por (1 + taxa real), menos 1.</p>
                <p>
                    {winner === 'tie'
                        ? `Com a inflação esperada igual à de equilíbrio, os dois rendem o mesmo.`
                        : winner === 'ipca-plus'
                          ? `Você espera ${pct(expected)}, acima do equilíbrio: o IPCA+ rende mais.`
                          : `Você espera ${pct(expected)}, abaixo do equilíbrio: o prefixado rende mais.`}
                </p>
                <p>Vale se você segurar os dois até o vencimento. Antes disso, o preço dos dois oscila com a taxa de mercado.</p>
            </div>
        </div>
    )
}

export function breakevenInflationSummary({ prefixedPct, realPct, expectedInflationPct }: BreakevenInflationWidgetProps): string {
    return `Inflação de equilíbrio entre um prefixado de ${pct(prefixedPct)} e um IPCA+ de ${pct(realPct)} mais inflação, começando com inflação esperada de ${pct(expectedInflationPct)}: mostra qual título rende mais para cada inflação esperada.`
}
