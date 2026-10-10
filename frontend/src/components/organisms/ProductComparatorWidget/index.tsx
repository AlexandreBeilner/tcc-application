import { useState } from 'react'
import { productResult, winnerIndex } from '../../../features/lessons/widgets/fixedIncomeMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { ProductComparatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { ComparedProduct, ProductComparatorWidgetProps } from './types'

// Widget `product-comparator` (RC.3.4a): 2 a 3 produtos lado a lado no mesmo
// valor e prazo, com o rendimento líquido de cada um e o vencedor.
export function ProductComparatorWidget({ products, amount: initialAmount, days: initialDays }: ProductComparatorWidgetProps) {
    const [amount, setAmount] = useState(initialAmount)
    const [days, setDays] = useState(initialDays)

    const valid = amount > 0 && days >= 1
    const results = valid ? products.map((product) => productResult(product, amount, days)) : []
    const winner = winnerIndex(results)
    const hasExtras = products.some((product) => product.liquidity || product.fgc)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Valor investido (R$)
                    <input type="number" min={0} step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Prazo (dias)
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={days || ''}
                        onChange={(e) => setDays(Math.trunc(Number(e.target.value)))}
                    />
                </label>
            </div>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <caption className={styles.visuallyHidden}>Comparação de produtos de renda fixa</caption>
                    <thead>
                        <tr>
                            <th scope="col">Produto</th>
                            <th scope="col">Taxa</th>
                            <th scope="col">IR</th>
                            {hasExtras && <th scope="col">Liquidez</th>}
                            {hasExtras && <th scope="col">FGC</th>}
                            <th scope="col">Líquido no prazo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product, index) => (
                            <tr key={product.name} className={winner === index ? styles.current : undefined}>
                                <th scope="row">
                                    {winner === index ? '★ ' : ''}
                                    {product.name}
                                </th>
                                <td>{String(product.annualRatePct).replace('.', ',')}% a.a.</td>
                                <td>{product.taxExempt ? 'Isento' : 'Tabela regressiva'}</td>
                                {hasExtras && <td>{product.liquidity ?? ''}</td>}
                                {hasExtras && <td>{product.fgc ?? ''}</td>}
                                <td>{results[index] ? formatCurrency(results[index].netYield) : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={styles.result} aria-live="polite">
                {!valid ? (
                    <p>Informe valor e prazo maiores que zero.</p>
                ) : winner === null ? (
                    <p className={styles.headline}>Empate: os produtos rendem o mesmo líquido neste prazo.</p>
                ) : (
                    <p className={styles.headline}>
                        {products[winner].name} rende mais líquido em {days} dias: {formatCurrency(results[winner].netYield)}.
                    </p>
                )}
            </div>
        </div>
    )
}

export function productComparatorSummary({ products }: ProductComparatorWidgetProps): string {
    return `Comparador de produtos de renda fixa: ${products.map((product) => product.name).join(', ')}, com rendimento líquido de imposto no prazo escolhido.`
}
