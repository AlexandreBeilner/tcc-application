import { useMemo, useState } from 'react'
import { GrowthChart } from '../GrowthChart'
import { OrderSummaryList } from '../OrderSummaryList'
import { computeGrowthProjection } from '../../../features/calculator/computeGrowthProjection'
import type { InterestMode } from '../../../features/calculator/computeGrowthProjection'
import { formatCurrency } from '../../../features/portfolio/format'
import styles from './index.module.css'

const MODE_LABEL: Record<InterestMode, string> = { simple: 'Juros simples', compound: 'Juros compostos' }

// Calculadora — modo simples (tela 6.1, wireframe original Fig. 7):
// "capital inicial, aporte mensal, taxa, período, resultado com gráfico
// total vs. investido" (inventário). 100% client-side/stateless (backlog
// 6.7) — sem query, sem mutation, `computeGrowthProjection` é pura e
// síncrona, recalculada a cada tecla via `useMemo`.
export function GrowthCalculatorForm() {
    const [initialCapital, setInitialCapital] = useState(1000)
    const [monthlyContribution, setMonthlyContribution] = useState(200)
    const [annualRatePct, setAnnualRatePct] = useState(12)
    const [months, setMonths] = useState(24)
    const [mode, setMode] = useState<InterestMode>('compound')

    const result = useMemo(
        () => computeGrowthProjection({ initialCapital, monthlyContribution, annualRatePct, months, mode }),
        [initialCapital, monthlyContribution, annualRatePct, months, mode],
    )

    return (
        <div className={styles.form}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Capital inicial (R$)
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={initialCapital || ''}
                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Aporte mensal (R$)
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={monthlyContribution || ''}
                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Taxa (% a.a.)
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={annualRatePct || ''}
                        onChange={(e) => setAnnualRatePct(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Período (meses)
                    <input
                        type="number"
                        min={0}
                        step="1"
                        value={months || ''}
                        onChange={(e) => setMonths(Math.trunc(Number(e.target.value)))}
                    />
                </label>
            </div>

            <div className={styles.tabs}>
                {(['simple', 'compound'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={[styles.tab, option === mode && styles.tabActive].filter(Boolean).join(' ')}
                        onClick={() => setMode(option)}
                    >
                        {MODE_LABEL[option]}
                    </button>
                ))}
            </div>

            {months > 0 ? (
                <>
                    <GrowthChart points={result.points} />
                    <OrderSummaryList
                        rows={[
                            { label: 'Total investido', value: formatCurrency(result.totalInvested) },
                            { label: 'Total em juros', value: formatCurrency(result.totalInterest) },
                            { label: 'Total final', value: formatCurrency(result.totalValue), variant: 'total' },
                        ]}
                    />
                </>
            ) : (
                <p className={styles.hint}>Informe um período maior que zero pra ver a projeção.</p>
            )}
        </div>
    )
}
