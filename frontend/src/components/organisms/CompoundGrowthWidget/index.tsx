import { useMemo, useState } from 'react'
import { GrowthChart } from '../GrowthChart'
import { computeGrowthProjection } from '../../../features/calculator/computeGrowthProjection'
import { formatCurrency } from '../../../features/portfolio/format'
import type { CompoundGrowthWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { CompoundGrowthWidgetProps } from './types'

const RATE_MAX = { year: 30, month: 3 } as const
const RATE_SUFFIX = { year: '% ao ano', month: '% ao mês' } as const

// Widget `compound-growth` (RC.3.4c): a curva de juros compostos com controles
// deslizantes (taxa e prazo) e campos de capital e aporte, reusando a mesma
// conta da Calculadora. Com `showSimple`, mostra o valor que os juros simples
// dariam, para a diferença aparecer em reais.
export function CompoundGrowthWidget({ initial, monthly, ratePct, rateUnit, months, showSimple }: CompoundGrowthWidgetProps) {
    const [capital, setCapital] = useState(initial)
    const [contribution, setContribution] = useState(monthly)
    const [rate, setRate] = useState(ratePct)
    const [period, setPeriod] = useState(months)

    const compound = useMemo(
        () =>
            computeGrowthProjection({
                initialCapital: capital,
                monthlyContribution: contribution,
                ratePct: rate,
                rateUnit,
                months: period,
                mode: 'compound',
            }),
        [capital, contribution, rate, rateUnit, period],
    )
    const simple = useMemo(
        () =>
            computeGrowthProjection({
                initialCapital: capital,
                monthlyContribution: contribution,
                ratePct: rate,
                rateUnit,
                months: period,
                mode: 'simple',
            }),
        [capital, contribution, rate, rateUnit, period],
    )
    const extraFromCompounding = compound.totalValue - simple.totalValue

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Capital inicial (R$)
                    <input
                        type="number"
                        min={0}
                        step="1"
                        value={capital || ''}
                        onChange={(e) => setCapital(Math.max(0, Number(e.target.value)))}
                    />
                </label>
                <label className={styles.field}>
                    Aporte mensal (R$)
                    <input
                        type="number"
                        min={0}
                        step="1"
                        value={contribution || ''}
                        onChange={(e) => setContribution(Math.max(0, Number(e.target.value)))}
                    />
                </label>
            </div>
            <label className={styles.field}>
                Taxa: {String(rate).replace('.', ',')}
                {RATE_SUFFIX[rateUnit]}
                <input
                    type="range"
                    min={0}
                    max={RATE_MAX[rateUnit]}
                    step={rateUnit === 'year' ? 0.5 : 0.05}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                />
            </label>
            <label className={styles.field}>
                Prazo: {period} {period === 1 ? 'mês' : 'meses'}
                <input type="range" min={1} max={480} step={1} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
            </label>
            <GrowthChart points={compound.points} />
            <div className={styles.result} aria-live="polite">
                <p>Total investido: {formatCurrency(compound.totalInvested)}</p>
                <p>Juros compostos acumulados: {formatCurrency(compound.totalInterest)}</p>
                <p className={styles.headline}>Valor final: {formatCurrency(compound.totalValue)}</p>
                {showSimple && (
                    <p>
                        Com juros simples, o mesmo prazo daria {formatCurrency(simple.totalValue)}. Os juros sobre juros somam{' '}
                        {formatCurrency(extraFromCompounding)} a mais.
                    </p>
                )}
            </div>
        </div>
    )
}

export function compoundGrowthSummary({ initial, monthly, ratePct, rateUnit, months }: CompoundGrowthWidgetProps): string {
    return `Calculadora de juros compostos: capital inicial de ${formatCurrency(initial)}, aporte mensal de ${formatCurrency(monthly)}, taxa de ${String(ratePct).replace('.', ',')}${RATE_SUFFIX[rateUnit]} por ${months} meses, com taxa e prazo ajustáveis.`
}
