import { useEffect, useMemo, useRef, useState } from 'react'
import { OrderSummaryList } from '../OrderSummaryList'
import { computeFixedIncomeComparison } from '../../../features/calculator/computeFixedIncomeComparison'
import type { ComparisonProductInput } from '../../../features/calculator/computeFixedIncomeComparison'
import { useFixedIncomeTaxRateQuery } from '../../../features/market/useFixedIncomeTaxRateQuery'
import { useReportCalculatorComparisonMission } from '../../../features/calculator/useReportCalculatorComparisonMission'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import styles from './index.module.css'

const DEFAULT_PRODUCTS: [ComparisonProductInput, ComparisonProductInput] = [
    { name: 'CDB 110% CDI', annualRatePct: 11, taxExempt: false },
    { name: 'LCI 90% CDI', annualRatePct: 9, taxExempt: true },
]

// Calculadora — modo comparação (tela 6.2): "dois produtos lado a lado,
// cada um com seus próprios parâmetros (incluindo isenção de IR quando
// aplicável), resultado líquido comparado" (inventário) — cumpre a lição
// 3.3 ("CDB 110% CDI líquido vs. LCI 90% CDI isento — qual rende mais?").
// Decisão (b) do backlog 6.7: produtos hipotéticos digitados pelo
// usuário, não um `asset_id` real do catálogo — valor e prazo são
// compartilhados entre os dois (mesma base de comparação), só taxa/nome/
// isenção variam por produto. `daysHeld` só chama o motor uma vez
// (`useFixedIncomeTaxRateQuery`, mesma alíquota pros dois produtos
// tributados — a Calculadora não modela produtos com prazos diferentes).
export function FixedIncomeComparisonForm() {
    const [amount, setAmount] = useState(10000)
    const [daysHeld, setDaysHeld] = useState(365)
    const [products, setProducts] = useState(DEFAULT_PRODUCTS)
    const reportComparison = useReportCalculatorComparisonMission()
    const hasReportedRef = useRef(false)

    const taxRateQuery = useFixedIncomeTaxRateQuery(daysHeld)
    const marketTaxRate = taxRateQuery.data?.tax_rate

    const results = useMemo(() => {
        if (marketTaxRate === undefined || amount <= 0 || daysHeld <= 0) return null
        return products.map((product) => computeFixedIncomeComparison(product, amount, daysHeld, marketTaxRate))
    }, [products, amount, daysHeld, marketTaxRate])

    useEffect(() => {
        if (results && !hasReportedRef.current) {
            hasReportedRef.current = true
            reportComparison()
        }
    }, [results, reportComparison])

    function updateProduct(index: 0 | 1, patch: Partial<ComparisonProductInput>) {
        setProducts((current) => {
            const next = [...current] as [ComparisonProductInput, ComparisonProductInput]
            next[index] = { ...next[index], ...patch }
            return next
        })
    }

    const winnerIndex = results && results[0].netValue !== results[1].netValue ? (results[0].netValue > results[1].netValue ? 0 : 1) : null

    return (
        <div className={styles.form}>
            <div className={styles.sharedFields}>
                <label className={styles.field}>
                    Valor a investir (R$)
                    <input type="number" min={0} step="0.01" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Prazo (dias corridos)
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={daysHeld || ''}
                        onChange={(e) => setDaysHeld(Math.trunc(Number(e.target.value)))}
                    />
                </label>
            </div>

            <div className={styles.products}>
                {products.map((product, index) => {
                    const result = results?.[index]
                    const isWinner = winnerIndex === index

                    return (
                        <div key={index} className={[styles.product, isWinner && styles.winner].filter(Boolean).join(' ')}>
                            <label className={styles.field}>
                                Nome do produto
                                <input
                                    type="text"
                                    value={product.name}
                                    onChange={(e) => updateProduct(index as 0 | 1, { name: e.target.value })}
                                />
                            </label>
                            <label className={styles.field}>
                                Taxa (% a.a.)
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={product.annualRatePct || ''}
                                    onChange={(e) => updateProduct(index as 0 | 1, { annualRatePct: Number(e.target.value) })}
                                />
                            </label>
                            <label className={styles.checkboxField}>
                                <input
                                    type="checkbox"
                                    checked={product.taxExempt}
                                    onChange={(e) => updateProduct(index as 0 | 1, { taxExempt: e.target.checked })}
                                />
                                Isento de IR
                            </label>

                            {result && (
                                <OrderSummaryList
                                    rows={[
                                        { label: 'Valor bruto', value: formatCurrency(result.grossValue) },
                                        { label: 'Alíquota de IR', value: formatPercentage(result.taxRate) },
                                        { label: 'Valor líquido', value: formatCurrency(result.netValue), variant: 'total' },
                                    ]}
                                />
                            )}

                            {isWinner && <p className={styles.winnerLabel}>Rende mais líquido</p>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
