import { useState } from 'react'
import { ownership } from '../../../features/lessons/widgets/equityMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { OwnershipCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { OwnershipCalculatorWidgetProps } from './types'

const toNumber = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
}

const pct = (value: number) => `${value.toFixed(4).replace('.', ',')}%`

// Widget `ownership-calculator` (RC.3.4e): quantas ações você tem, quantas a
// empresa emitiu e o preço viram a sua fatia da empresa, o valor dela e o
// dividendo proporcional ao que a empresa decide distribuir. O lucro retido não
// vai para o bolso: ele só aparece no valor da empresa.
export function OwnershipCalculatorWidget({ price, totalShares, yourShares, profit, payoutPct }: OwnershipCalculatorWidgetProps) {
    const [yours, setYours] = useState(yourShares)
    const [payout, setPayout] = useState(payoutPct)
    const [sharePrice, setSharePrice] = useState(price)

    const result = ownership(sharePrice, totalShares, yours, profit, payout)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Suas ações
                    <input
                        type="number"
                        min={0}
                        step={10}
                        inputMode="numeric"
                        value={yours}
                        onChange={(e) => setYours(toNumber(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Preço por ação (R$)
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        inputMode="decimal"
                        value={sharePrice}
                        onChange={(e) => setSharePrice(toNumber(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Parte do lucro distribuída: {payout}%
                    <input type="range" min={0} max={100} step={5} value={payout} onChange={(e) => setPayout(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p>
                    A empresa emitiu {totalShares.toLocaleString('pt-BR')} ações e deu lucro de {formatCurrency(profit)} no ano.
                </p>
                <p className={styles.headline}>
                    Você é dono de {pct(result.ownershipPct)} da empresa, uma fatia de {formatCurrency(result.yourValue)}.
                </p>
                <p>Valor de mercado da empresa: {formatCurrency(result.marketCap)}.</p>
                <p>
                    Se ela distribuir {payout}% do lucro, o seu dividendo é de {formatCurrency(result.dividend)}.
                </p>
                <p>
                    O resto do lucro fica na empresa. Ele não vai para o seu bolso, mas pode valorizar a ação. E o máximo que você perde é o
                    que investiu.
                </p>
            </div>
        </div>
    )
}

export function ownershipCalculatorSummary({ price, totalShares, yourShares, profit, payoutPct }: OwnershipCalculatorWidgetProps): string {
    return `Calculadora de participação: com ${yourShares} de ${totalShares.toLocaleString('pt-BR')} ações a ${formatCurrency(price)} cada, lucro de ${formatCurrency(profit)} e ${payoutPct}% distribuído, mostra a fatia da empresa, o valor dela e o dividendo proporcional.`
}
