import { useEffect, useState } from 'react'
import { IR_BRACKETS, irBracketForDays, irOnYield } from '../../../features/lessons/widgets/fixedIncomeMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { IrRegressiveTableWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { IrRegressiveTableWidgetProps } from './types'

// Widget `ir-regressive-table` (RC.3.4a): a tabela regressiva com o prazo
// ajustável por um controle deslizante; a faixa atual fica destacada (texto em
// negrito e marcador, não só cor) e o imposto sai calculado.
export function IrRegressiveTableWidget({ grossYield, initialDays, onMetrics }: IrRegressiveTableWidgetProps) {
    const [days, setDays] = useState(initialDays)
    const current = irBracketForDays(days)
    const { tax, net } = irOnYield(grossYield, days)
    const irRatePct = current.ratePct
    useEffect(() => onMetrics?.({ irRatePct }), [irRatePct, onMetrics])

    return (
        <div className={styles.root}>
            <label className={styles.field}>
                Prazo da aplicação: {days} dias
                <input type="range" min={1} max={1000} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </label>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <caption className={styles.visuallyHidden}>Alíquota de imposto de renda por prazo</caption>
                    <thead>
                        <tr>
                            <th scope="col">Prazo</th>
                            <th scope="col">Alíquota</th>
                        </tr>
                    </thead>
                    <tbody>
                        {IR_BRACKETS.map((bracket) => (
                            <tr
                                key={bracket.label}
                                className={bracket === current ? styles.current : undefined}
                                aria-current={bracket === current}
                            >
                                <td>
                                    {bracket === current ? '▶ ' : ''}
                                    {bracket.label}
                                </td>
                                <td>{String(bracket.ratePct).replace('.', ',')}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={styles.result} aria-live="polite">
                <p>Rendimento bruto: {formatCurrency(grossYield)}</p>
                <p>
                    Imposto de {String(current.ratePct).replace('.', ',')}%: {formatCurrency(tax)}
                </p>
                <p className={styles.headline}>Rendimento líquido: {formatCurrency(net)}</p>
            </div>
        </div>
    )
}

export function irRegressiveTableSummary({ grossYield }: IrRegressiveTableWidgetProps): string {
    return `Tabela regressiva de imposto de renda: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima, aplicada a um rendimento bruto de ${formatCurrency(grossYield)}.`
}
