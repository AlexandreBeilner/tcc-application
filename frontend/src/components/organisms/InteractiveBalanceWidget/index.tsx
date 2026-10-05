import { useState } from 'react'
import { balanceSheet, dre, formatMillions } from '../../../features/lessons/widgets/companyMath'
import type { InteractiveBalanceWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { InteractiveBalanceWidgetProps } from './types'

// Widget `interactive-balance` (RC.3.4f): a DRE em cascata (da receita líquida
// ao lucro líquido) e, abaixo, a equação do balanço (Ativo = Passivo + Patrimônio
// Líquido). O aluno mexe nos custos, nas despesas, nos juros e no imposto e vê
// cada degrau; no balanço, o patrimônio líquido é o que sobra do ativo depois
// das dívidas. Valores em milhões de reais, de exemplo.
export function InteractiveBalanceWidget(props: InteractiveBalanceWidgetProps) {
    const [costsPct, setCostsPct] = useState(props.costsPct)
    const [expensesPct, setExpensesPct] = useState(props.expensesPct)
    const [interest, setInterest] = useState(-props.financialResult)
    const [taxPct, setTaxPct] = useState(props.taxPct)
    const [cash, setCash] = useState(props.cash)
    const [fixedAssets, setFixedAssets] = useState(props.fixedAssets)
    const [debt, setDebt] = useState(props.debt)
    const [other, setOther] = useState(props.otherLiabilities)

    const result = dre(props.netRevenue, costsPct, expensesPct, -interest, taxPct)
    const sheet = balanceSheet(cash, fixedAssets, debt, other)
    const steps = [
        { label: 'Receita líquida', value: result.netRevenue },
        { label: 'Lucro bruto (depois dos custos)', value: result.grossProfit },
        { label: 'EBIT (depois das despesas)', value: result.ebit },
        { label: 'Lucro antes do imposto (depois dos juros)', value: result.ebt },
        { label: 'Lucro líquido (depois do imposto)', value: result.netIncome },
    ]

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Custos: {costsPct}% da receita
                    <input type="range" min={0} max={90} step={1} value={costsPct} onChange={(e) => setCostsPct(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Despesas operacionais: {expensesPct}% da receita
                    <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={expensesPct}
                        onChange={(e) => setExpensesPct(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Juros pagos: {formatMillions(interest)}
                    <input
                        type="range"
                        min={0}
                        max={300}
                        step={10}
                        value={interest}
                        onChange={(e) => setInterest(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Imposto sobre o lucro: {taxPct}%
                    <input type="range" min={0} max={40} step={1} value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} />
                </label>
            </div>
            <ul className={styles.bars} aria-label="DRE em cascata">
                {steps.map((step) => (
                    <li key={step.label} className={styles.barRow}>
                        <span className={styles.barLabel}>{step.label}</span>
                        <span className={styles.barTrack}>
                            <span
                                className={step.value < 0 ? styles.barFillNegative : styles.barFill}
                                style={{ width: `${Math.min(100, (Math.abs(step.value) / result.netRevenue) * 100)}%` }}
                            />
                        </span>
                        <span className={styles.barValue}>{formatMillions(step.value)}</span>
                    </li>
                ))}
            </ul>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Caixa: {formatMillions(cash)}
                    <input type="range" min={0} max={1000} step={50} value={cash} onChange={(e) => setCash(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Imobilizado e outros ativos: {formatMillions(fixedAssets)}
                    <input
                        type="range"
                        min={0}
                        max={2000}
                        step={50}
                        value={fixedAssets}
                        onChange={(e) => setFixedAssets(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Dívida: {formatMillions(debt)}
                    <input type="range" min={0} max={2000} step={50} value={debt} onChange={(e) => setDebt(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Outros passivos: {formatMillions(other)}
                    <input type="range" min={0} max={1000} step={50} value={other} onChange={(e) => setOther(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Lucro líquido de {formatMillions(result.netIncome)} sobre uma receita de {formatMillions(result.netRevenue)}.
                </p>
                <p>
                    Ativo de {formatMillions(sheet.assets)} é igual ao passivo de {formatMillions(sheet.liabilities)} mais o patrimônio
                    líquido de {formatMillions(sheet.equity)}.
                </p>
                {sheet.equity < 0 && <p>O patrimônio líquido ficou negativo: as dívidas e obrigações passam do que a empresa tem.</p>}
                <p>O patrimônio líquido é valor contábil: o que sobra do ativo depois das dívidas, e não o que a empresa vale na bolsa.</p>
            </div>
        </div>
    )
}

export function interactiveBalanceSummary(props: InteractiveBalanceWidgetProps): string {
    return `Demonstração de resultado em cascata e balanço: com receita líquida de ${formatMillions(props.netRevenue)}, custos de ${props.costsPct}%, despesas de ${props.expensesPct}%, juros e imposto ajustáveis, mostra cada etapa até o lucro líquido, e a equação Ativo = Passivo + Patrimônio Líquido.`
}
