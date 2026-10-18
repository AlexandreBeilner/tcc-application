import { useEffect, useState } from 'react'
import { FACE_VALUE } from '../../../features/lessons/widgets/mtmMath'
import { bondPurchase, CUSTODY_ANNUAL_PCT } from '../../../features/lessons/widgets/treasuryMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BondPriceCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { BondPriceCalculatorWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

const toAmount = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
}

// Widget `bond-price-calculator` (RC.3.4d): taxa, prazo e valor viram o preço do
// título prefixado sem cupom, o deságio e o que sobra depois de IR e custódia. A
// barra mostra os R$ 1.000 do vencimento divididos entre o que se paga hoje
// (sólido) e o deságio (listrado), que é o juro embutido no preço.
export function BondPriceCalculatorWidget({ ratePct, years, amount, onMetrics }: BondPriceCalculatorWidgetProps) {
    const [rate, setRate] = useState(ratePct)
    const [term, setTerm] = useState(years)
    const [invested, setInvested] = useState(amount)

    const purchase = bondPurchase(rate, term, invested)
    const paidShare = (purchase.unitPrice / FACE_VALUE) * 100
    const unitPrice = purchase.unitPrice
    useEffect(() => onMetrics?.({ unitPrice }), [unitPrice, onMetrics])

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Taxa contratada: {pct(rate)} ao ano
                    <input type="range" min={6} max={18} step={0.25} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Prazo: {term.toFixed(2).replace('.', ',')} anos
                    <input type="range" min={0.25} max={10} step={0.25} value={term} onChange={(e) => setTerm(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Valor investido (R$)
                    <input
                        type="number"
                        min={30}
                        step={100}
                        inputMode="decimal"
                        value={invested}
                        onChange={(e) => setInvested(toAmount(e.target.value))}
                    />
                </label>
            </div>
            <div
                className={styles.stack}
                role="img"
                aria-label={`De ${formatCurrency(FACE_VALUE)} no vencimento, ${formatCurrency(purchase.unitPrice)} são o preço de hoje e ${formatCurrency(purchase.discount)} são o deságio`}
            >
                <span className={styles.stackCovered} style={{ width: `${paidShare}%` }} />
                <span className={styles.stackUncovered} style={{ width: `${100 - paidShare}%` }} />
            </div>
            <ul className={styles.legend}>
                <li>
                    <span className={styles.swatchSolid} /> Preço de hoje
                </li>
                <li>
                    <span className={styles.swatchStriped} /> Deságio (o juro embutido)
                </li>
            </ul>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Cada título custa {formatCurrency(purchase.unitPrice)} e paga {formatCurrency(FACE_VALUE)} no vencimento.
                </p>
                <p>
                    Deságio: {formatCurrency(purchase.discount)} ({pct(purchase.discountPct)} do valor de face). Com{' '}
                    {formatCurrency(invested)} você compra {purchase.quantity.toFixed(2).replace('.', ',')} títulos.
                </p>
                <p>Bruto no vencimento: {formatCurrency(purchase.grossAtMaturity)}.</p>
                <p>
                    Imposto de renda ({String(purchase.irRatePct).replace('.', ',')}%): {formatCurrency(purchase.ir)}. Custódia da B3 (cerca
                    de {String(CUSTODY_ANNUAL_PCT).replace('.', ',')}% ao ano): {formatCurrency(purchase.custody)}.
                </p>
                <p className={styles.headline}>
                    Ganho líquido: {formatCurrency(purchase.netGain)}, cerca de {pct(purchase.netAnnualPct)} ao ano.
                </p>
            </div>
        </div>
    )
}

export function bondPriceCalculatorSummary({ ratePct, years, amount }: BondPriceCalculatorWidgetProps): string {
    return `Calculadora do preço de um título prefixado sem cupom: com taxa de ${pct(ratePct)} ao ano, ${years.toFixed(2).replace('.', ',')} anos de prazo e ${formatCurrency(amount)} investidos, mostra o preço de hoje, o deságio, o valor bruto no vencimento e o ganho líquido de imposto de renda e custódia.`
}
