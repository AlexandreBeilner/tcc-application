import { useState } from 'react'
import { copomLean, inflationBand, INFLATION_TARGET_PCT, INFLATION_TOLERANCE_PP } from '../../../features/lessons/widgets/macroMath'
import type { CopomLean } from '../../../features/lessons/widgets/macroMath'
import type { InflationSelicSeesawWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { InflationSelicSeesawWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

const LEAN_HEADLINE: Record<CopomLean, string> = {
    raise: 'Pressão para subir a Selic',
    hold: 'Tendência de manter a Selic',
    cut: 'Pressão para reduzir a Selic',
}

const LEAN_CHAIN: Record<CopomLean, string> = {
    raise: 'Selic sobe, o crédito fica mais caro, o consumo esfria e a inflação tende a cair.',
    hold: 'Com a inflação dentro do intervalo da meta, o Copom não tem urgência em mexer nos juros.',
    cut: 'Selic cai, o crédito fica mais barato, o consumo aquece e a inflação tende a subir.',
}

const BAND_TEXT = {
    above: 'acima do intervalo da meta',
    inside: 'dentro do intervalo da meta',
    below: 'abaixo do intervalo da meta',
} as const

const LOW = INFLATION_TARGET_PCT - INFLATION_TOLERANCE_PP
const HIGH = INFLATION_TARGET_PCT + INFLATION_TOLERANCE_PP

// Widget `inflation-selic-seesaw` (RC.5.4): o aluno move a inflação em 12 meses
// e vê para onde a gangorra da Selic pende. É a intuição, não a regra do
// Copom, que olha expectativas, atividade e cenário (o widget diz isso).
export function InflationSelicSeesawWidget({ inflationPct }: InflationSelicSeesawWidgetProps) {
    const [inflation, setInflation] = useState(inflationPct)
    const lean = copomLean(inflation)

    return (
        <div className={styles.root}>
            <label className={styles.field}>
                Inflação em 12 meses: {pct(inflation)}
                <input type="range" min={0} max={15} step={0.5} value={inflation} onChange={(e) => setInflation(Number(e.target.value))} />
            </label>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>{LEAN_HEADLINE[lean]}</p>
                <p>
                    A meta é {pct(INFLATION_TARGET_PCT)}, com tolerância de {pct(INFLATION_TOLERANCE_PP)} para cima e para baixo (de{' '}
                    {pct(LOW)} a {pct(HIGH)}). Com {pct(inflation)}, a inflação está {BAND_TEXT[inflationBand(inflation)]}.
                </p>
                <p>{LEAN_CHAIN[lean]}</p>
                <p>É a intuição: o Copom olha também as expectativas, a atividade e o cenário externo, e não aplica uma fórmula.</p>
            </div>
        </div>
    )
}

export function inflationSelicSeesawSummary({ inflationPct }: InflationSelicSeesawWidgetProps): string {
    return `Gangorra entre inflação e Selic: com a inflação em 12 meses começando em ${pct(inflationPct)}, mostra se ela está acima, dentro ou abaixo do intervalo da meta e para onde a Selic tende a ir. Controle deslizante de 0% a 15%.`
}
