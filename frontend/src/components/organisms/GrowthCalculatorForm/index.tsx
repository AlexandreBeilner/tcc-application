import { useEffect, useMemo, useState } from 'react'
import { GrowthChart } from '../GrowthChart'
import { GrowthProjectionTable } from '../GrowthProjectionTable'
import { OrderSummaryList } from '../OrderSummaryList'
import { computeGrowthProjection, resolvePeriodInMonths } from '../../../features/calculator/computeGrowthProjection'
import type { InterestMode, PeriodUnit, RateUnit } from '../../../features/calculator/computeGrowthProjection'
import { formatCurrency } from '../../../features/portfolio/format'
import type { GrowthCalculatorFormProps } from './types'
import styles from './index.module.css'

const MODE_LABEL: Record<InterestMode, string> = { simple: 'Juros simples', compound: 'Juros compostos' }
const RATE_UNIT_LABEL: Record<RateUnit, string> = { year: '% a.a.', month: '% a.m.' }
const PERIOD_UNIT_LABEL: Record<PeriodUnit, string> = { months: 'Meses', years: 'Anos' }

// Calculadora — modo simples (tela 6.1, wireframe original Fig. 7):
// "capital inicial, aporte mensal, taxa, período, resultado com gráfico
// total vs. investido" (inventário). 100% client-side/stateless (backlog
// 6.7) — sem query, sem mutation, `computeGrowthProjection` é pura e
// síncrona, recalculada a cada tecla via `useMemo`.
//
// Tarefa 6.7.1 (achado em revisão do autor): taxa anual + período mensal
// lado a lado confundia — toggle de unidade em taxa (% a.a./% a.m.) e
// período (meses/anos), cada um resolvido pra mês antes de chegar em
// `computeGrowthProjection` (`resolvePeriodInMonths`) ou direto na função
// pura (`rateUnit`). Trocar a unidade **reinicia o valor do campo** (não
// converte) — decisão do autor: manter o número antigo na unidade nova
// passaria uma falsa equivalência (ex: "12" virando de "% a.a." pra
// "% a.m." sem reformular o número seria lido como "12% a.m.", 12x maior
// do que o usuário digitou). Tarefa 6.7.3: período é sempre um inteiro,
// em qualquer unidade (não faz sentido "2,5 meses"; anos fracionários
// também foram descartados a pedido do autor) — `Math.trunc` no onChange,
// `step="1"` no input.
//
// Defaults (tarefa 6.7.3, pedido do autor): juros compostos é o padrão
// (regime mais comum em produtos reais); taxa 10% a.a.; período 1 ano;
// capital inicial e aporte mensal começam em 0 — a tela nasce "em branco"
// pro usuário digitar os próprios números, em vez de um exemplo
// pré-preenchido que ele precisa apagar primeiro.
export function GrowthCalculatorForm(props: GrowthCalculatorFormProps) {
    const { onMetrics } = props
    const [initialCapital, setInitialCapital] = useState(props.initialCapital ?? 0)
    const [monthlyContribution, setMonthlyContribution] = useState(props.monthlyContribution ?? 0)
    const [ratePct, setRatePct] = useState(props.ratePct ?? 10)
    const [rateUnit, setRateUnit] = useState<RateUnit>('year')
    const [periodValue, setPeriodValue] = useState(props.periodYears ?? 1)
    const [periodUnit, setPeriodUnit] = useState<PeriodUnit>('years')
    const [mode, setMode] = useState<InterestMode>('compound')

    const months = resolvePeriodInMonths(periodValue, periodUnit)

    const result = useMemo(
        () => computeGrowthProjection({ initialCapital, monthlyContribution, ratePct, rateUnit, months, mode }),
        [initialCapital, monthlyContribution, ratePct, rateUnit, months, mode],
    )

    // Missão (LJ.3.1): quantas vezes os juros compostos superam os simples com os mesmos números, qualquer que seja
    // a aba aberta. Zero enquanto não houver juros para comparar.
    const interestRatio = useMemo(() => {
        const input = { initialCapital, monthlyContribution, ratePct, rateUnit, months }
        const simple = computeGrowthProjection({ ...input, mode: 'simple' }).totalInterest
        return simple > 0 ? computeGrowthProjection({ ...input, mode: 'compound' }).totalInterest / simple : 0
    }, [initialCapital, monthlyContribution, ratePct, rateUnit, months])
    useEffect(() => onMetrics?.({ interestRatio }), [interestRatio, onMetrics])

    function handleRateUnitChange(unit: RateUnit) {
        if (unit === rateUnit) return
        setRateUnit(unit)
        setRatePct(0)
    }

    function handlePeriodUnitChange(unit: PeriodUnit) {
        if (unit === periodUnit) return
        setPeriodUnit(unit)
        setPeriodValue(0)
    }

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

                <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                        <span>Taxa</span>
                        <div className={styles.unitToggle}>
                            {(['year', 'month'] as const).map((unit) => (
                                <button
                                    key={unit}
                                    type="button"
                                    className={[styles.unitOption, unit === rateUnit && styles.unitOptionActive].filter(Boolean).join(' ')}
                                    onClick={() => handleRateUnitChange(unit)}
                                >
                                    {RATE_UNIT_LABEL[unit]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label="Taxa"
                        value={ratePct || ''}
                        onChange={(e) => setRatePct(Number(e.target.value))}
                    />
                </div>

                <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                        <span>Período</span>
                        <div className={styles.unitToggle}>
                            {(['months', 'years'] as const).map((unit) => (
                                <button
                                    key={unit}
                                    type="button"
                                    className={[styles.unitOption, unit === periodUnit && styles.unitOptionActive]
                                        .filter(Boolean)
                                        .join(' ')}
                                    onClick={() => handlePeriodUnitChange(unit)}
                                >
                                    {PERIOD_UNIT_LABEL[unit]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        type="number"
                        min={0}
                        step="1"
                        aria-label="Período"
                        value={periodValue || ''}
                        onChange={(e) => setPeriodValue(Math.trunc(Number(e.target.value)))}
                    />
                </div>
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
                    <GrowthProjectionTable points={result.points} />
                </>
            ) : (
                <p className={styles.hint}>Informe um período maior que zero pra ver a projeção.</p>
            )}
        </div>
    )
}
