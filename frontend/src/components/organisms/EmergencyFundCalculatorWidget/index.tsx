import { useState } from 'react'
import { emergencyFundTarget, monthsToReach } from '../../../features/lessons/widgets/emergencyMath'
import type { IncomeType } from '../../../features/lessons/widgets/emergencyMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { EmergencyFundCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { EmergencyFundCalculatorWidgetProps } from './types'

const INCOME_LABEL: Record<IncomeType, string> = { stable: 'Renda estável', variable: 'Renda variável ou autônomo' }

const toNumber = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
}

// Widget `emergency-fund-calculator` (RC.4.6): custo de vida essencial por mês e
// tipo de renda viram uma meta em reais e um prazo de aporte. As faixas de meses
// são regra de bolso, e o widget diz isso na tela.
export function EmergencyFundCalculatorWidget({ monthlyCost, incomeType, monthlyContribution }: EmergencyFundCalculatorWidgetProps) {
    const [cost, setCost] = useState(monthlyCost)
    const [type, setType] = useState<IncomeType>(incomeType)
    const [contribution, setContribution] = useState(monthlyContribution)

    const target = emergencyFundTarget(cost, type)
    const months = monthsToReach(target.minAmount, contribution)

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Tipo de renda">
                {(Object.keys(INCOME_LABEL) as IncomeType[]).map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={styles.preset}
                        aria-pressed={type === option}
                        onClick={() => setType(option)}
                    >
                        {INCOME_LABEL[option]}
                    </button>
                ))}
            </div>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Custo de vida essencial por mês (R$)
                    <input type="number" min={0} step={100} value={cost} onChange={(e) => setCost(toNumber(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Quanto você consegue guardar por mês (R$)
                    <input
                        type="number"
                        min={0}
                        step={50}
                        value={contribution}
                        onChange={(e) => setContribution(toNumber(e.target.value))}
                    />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Meta: {formatCurrency(target.minAmount)} a {formatCurrency(target.maxAmount)}
                </p>
                <p>
                    São {target.minMonths} a {target.maxMonths} meses do seu custo de vida essencial (comida, moradia, contas, saúde), não
                    da sua renda.
                </p>
                <p>
                    {months === null
                        ? 'Informe quanto consegue guardar por mês para ver o prazo.'
                        : `Guardando ${formatCurrency(contribution)} por mês, você chega a ${formatCurrency(target.minAmount)} em ${months} ${months === 1 ? 'mês' : 'meses'}, sem contar o rendimento.`}
                </p>
                <p>As faixas de meses são uma regra de bolso usada em educação financeira, não uma norma.</p>
            </div>
        </div>
    )
}

export function emergencyFundCalculatorSummary({ monthlyCost, incomeType }: EmergencyFundCalculatorWidgetProps): string {
    const target = emergencyFundTarget(monthlyCost, incomeType)
    return `Calculadora de reserva de emergência: com custo essencial de ${formatCurrency(monthlyCost)} por mês e ${INCOME_LABEL[incomeType].toLowerCase()}, a meta é de ${formatCurrency(target.minAmount)} a ${formatCurrency(target.maxAmount)}, com prazo de aporte ajustável.`
}
