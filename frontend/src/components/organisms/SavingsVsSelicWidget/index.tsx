import { useState } from 'react'
import { compareSavingsToTesouroSelic, SAVINGS_SELIC_THRESHOLD_PCT } from '../../../features/lessons/widgets/savingsMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { SavingsVsSelicWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { SavingsVsSelicWidgetProps } from './types'

const pct = (value: number, digits = 2) => `${value.toFixed(digits).replace('.', ',')}%`

// Widget `savings-vs-selic` (RC.5.2): o aluno mexe na meta da Selic, na TR e no
// prazo e vê qual regra a poupança usa e quanto ela rende frente ao Tesouro
// Selic já descontado o imposto de renda. A fronteira de 8,5% aparece como
// texto, não só como número solto.
export function SavingsVsSelicWidget({ selicPct, trMonthlyPct, amount, months }: SavingsVsSelicWidgetProps) {
    const [selic, setSelic] = useState(selicPct)
    const [tr, setTr] = useState(trMonthlyPct)
    const [period, setPeriod] = useState(months)

    const result = compareSavingsToTesouroSelic({ amount, selicPct: selic, trMonthlyPct: tr, months: period })
    const ruleText =
        result.rule === 'fixed'
            ? `Meta acima de ${pct(SAVINGS_SELIC_THRESHOLD_PCT, 1)}: a poupança rende 0,5% ao mês mais a TR.`
            : `Meta em ${pct(SAVINGS_SELIC_THRESHOLD_PCT, 1)} ou menos: a poupança rende 70% da meta ao ano mais a TR.`

    return (
        <div className={styles.root}>
            <label className={styles.field}>
                Meta da Selic: {pct(selic)} ao ano
                <input type="range" min={2} max={16} step={0.25} value={selic} onChange={(e) => setSelic(Number(e.target.value))} />
            </label>
            <label className={styles.field}>
                TR do mês: {pct(tr)}
                <input type="range" min={0} max={0.3} step={0.01} value={tr} onChange={(e) => setTr(Number(e.target.value))} />
            </label>
            <label className={styles.field}>
                Prazo: {period} {period === 1 ? 'mês' : 'meses'}
                <input type="range" min={1} max={36} step={1} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
            </label>
            <div className={styles.result} aria-live="polite">
                <p>{ruleText}</p>
                <p>
                    Poupança: {pct(result.savingsAnnualPct)} ao ano. {formatCurrency(amount)} viram {formatCurrency(result.savingsFinal)},
                    sem imposto de renda.
                </p>
                <p>
                    Tesouro Selic: {formatCurrency(amount)} viram {formatCurrency(result.tesouroGrossFinal)} antes do imposto e{' '}
                    {formatCurrency(result.tesouroNetFinal)} depois de {pct(result.tesouroIrRatePct, 1)} de imposto de renda.
                </p>
                <p className={styles.headline}>
                    {result.savingsWins
                        ? `A poupança rende mais ${formatCurrency(result.savingsFinal - result.tesouroNetFinal)} que o Tesouro Selic líquido.`
                        : `O Tesouro Selic líquido rende mais ${formatCurrency(result.tesouroNetFinal - result.savingsFinal)} que a poupança.`}
                </p>
                <p>Conta aproximada: o Tesouro Selic a 100% da meta, sem custódia, com 30 dias por mês.</p>
            </div>
        </div>
    )
}

export function savingsVsSelicSummary({ selicPct, months }: SavingsVsSelicWidgetProps): string {
    return `Comparação entre a poupança e o Tesouro Selic líquido de imposto: com meta da Selic de ${pct(selicPct)} ao ano e prazo de ${months} meses, com Selic, TR e prazo ajustáveis.`
}
