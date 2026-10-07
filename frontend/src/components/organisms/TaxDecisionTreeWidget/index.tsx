import { useState } from 'react'
import { taxDecision } from '../../../features/lessons/widgets/equityTaxMath'
import type { AssetClass } from '../../../features/lessons/widgets/equityTaxMath'
import type { TaxDecisionTreeWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { TaxDecisionTreeWidgetProps } from './types'

const ASSETS: { value: AssetClass; label: string }[] = [
    { value: 'stock', label: 'Ação' },
    { value: 'etf', label: 'ETF' },
    { value: 'fii', label: 'FII' },
]

// Widget `tax-decision-tree` (RC.4.7): três perguntas levam ao tratamento do imposto. A
// pergunta do valor vendido só aparece para ação vendida em outro dia, que é o único
// caso em que a isenção de R$ 20 mil importa.
export function TaxDecisionTreeWidget(_props: TaxDecisionTreeWidgetProps) {
    const [asset, setAsset] = useState<AssetClass | null>(null)
    const [sameDay, setSameDay] = useState<boolean | null>(null)
    const [upTo20k, setUpTo20k] = useState<boolean | null>(null)

    const needsSales = asset === 'stock' && sameDay === false
    const done = asset !== null && sameDay !== null && (!needsSales || upTo20k !== null)
    const decision = done ? taxDecision(asset, sameDay, upTo20k) : null

    return (
        <div className={styles.root}>
            <p className={styles.headline}>1. O que você vendeu?</p>
            <div className={styles.presets} role="group" aria-label="O que você vendeu?">
                {ASSETS.map((a) => (
                    <button
                        key={a.value}
                        type="button"
                        className={styles.preset}
                        aria-pressed={asset === a.value}
                        onClick={() => setAsset(a.value)}
                    >
                        {a.label}
                    </button>
                ))}
            </div>
            <p className={styles.headline}>2. Comprou e vendeu no mesmo dia?</p>
            <div className={styles.presets} role="group" aria-label="Comprou e vendeu no mesmo dia?">
                {[true, false].map((v) => (
                    <button
                        key={String(v)}
                        type="button"
                        className={styles.preset}
                        aria-pressed={sameDay === v}
                        onClick={() => setSameDay(v)}
                    >
                        {v ? 'Sim' : 'Não'}
                    </button>
                ))}
            </div>
            {needsSales && (
                <>
                    <p className={styles.headline}>3. Quanto você vendeu em ações no mês, no total?</p>
                    <div className={styles.presets} role="group" aria-label="Total vendido em ações no mês">
                        {[true, false].map((v) => (
                            <button
                                key={String(v)}
                                type="button"
                                className={styles.preset}
                                aria-pressed={upTo20k === v}
                                onClick={() => setUpTo20k(v)}
                            >
                                {v ? 'Até R$ 20 mil' : 'Mais de R$ 20 mil'}
                            </button>
                        ))}
                    </div>
                </>
            )}
            <div className={styles.result} aria-live="polite">
                {decision ? (
                    <>
                        <p className={styles.headline}>{decision.headline}</p>
                        <p>{decision.detail}</p>
                    </>
                ) : (
                    <p>Responda as perguntas para ver como a venda é tributada.</p>
                )}
            </div>
        </div>
    )
}

export function taxDecisionTreeSummary(_props: TaxDecisionTreeWidgetProps): string {
    return 'Árvore de decisão do imposto: você diz o que vendeu, se foi no mesmo dia e, para ações, se o total do mês passou de R$ 20 mil, e vê a alíquota, a isenção e como pagar.'
}
