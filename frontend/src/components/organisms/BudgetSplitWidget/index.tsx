import { useState } from 'react'
import { BUDGET_CATEGORIES, RULE_NEEDS_PCT, RULE_SAVE_PCT, RULE_WANTS_PCT, budgetSplit } from '../../../features/lessons/widgets/budgetMath'
import type { BudgetValues } from '../../../features/lessons/widgets/budgetMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { BudgetSplitWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { BudgetSplitWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

// Widget `budget-split` (RC.4.4): renda líquida e seis categorias de gasto. Mostra a sobra
// em reais e em %, avisa quando o gasto passa da renda e compara com a regra de bolso
// 50/30/20 (popular, não oficial). A barra empilhada tem o valor escrito em cada linha,
// então a leitura não depende da cor.
export function BudgetSplitWidget(props: BudgetSplitWidgetProps) {
    const [income, setIncome] = useState(props.income)
    const [values, setValues] = useState<BudgetValues>({
        housing: props.housing,
        food: props.food,
        transport: props.transport,
        leisure: props.leisure,
        debts: props.debts,
        other: props.other,
    })

    const result = budgetSplit(income, values)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Renda líquida do mês: {formatCurrency(income)}
                    <input
                        type="range"
                        min={1000}
                        max={20_000}
                        step={100}
                        value={income}
                        onChange={(e) => setIncome(Number(e.target.value))}
                    />
                </label>
                {BUDGET_CATEGORIES.map(({ key, label }) => (
                    <label key={key} className={styles.field}>
                        {label}: {formatCurrency(values[key])}
                        <input
                            type="range"
                            min={0}
                            max={10_000}
                            step={50}
                            value={values[key]}
                            onChange={(e) => setValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        />
                    </label>
                ))}
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {result.overspent
                        ? `Você gasta ${formatCurrency(-result.surplus)} a mais do que ganha.`
                        : `Sobra ${formatCurrency(result.surplus)} (${pct(result.surplusPct)} da renda) para poupar ou investir.`}
                </p>
                <p>
                    Gastos do mês: {formatCurrency(result.spent)} de {formatCurrency(income)}.
                </p>
                <p>
                    Necessidades (moradia, alimentação, transporte): {pct(result.needsPct)} da renda, contra {RULE_NEEDS_PCT}% na regra
                    50/30/20.
                </p>
                <p>
                    Desejos (lazer e outros): {pct(result.wantsPct)}, contra {RULE_WANTS_PCT}%.
                </p>
                <p>
                    Poupar e quitar dívidas (dívidas mais a sobra): {pct(result.saveDebtPct)}, contra {RULE_SAVE_PCT}%.
                </p>
                <p>A 50/30/20 é uma regra de bolso popular, um ponto de partida e não uma lei.</p>
            </div>
        </div>
    )
}

export function budgetSplitSummary({ income }: BudgetSplitWidgetProps): string {
    return `Orçamento mensal: com renda líquida a partir de ${formatCurrency(income)}, você ajusta seis categorias de gasto (moradia, alimentação, transporte, lazer, dívidas e outros) e vê a sobra em reais e em porcentagem, o aviso de gasto acima da renda e a comparação com a regra de bolso 50/30/20.`
}
