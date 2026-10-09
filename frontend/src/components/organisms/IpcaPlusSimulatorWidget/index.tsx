import { useState } from 'react'
import { ipcaPlusOutcome, ipcaPlusYears } from '../../../features/lessons/widgets/treasuryMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { IpcaPlusSimulatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { IpcaPlusSimulatorWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`

const IPCA_PRESETS = [
    { label: 'Na meta (3%)', value: 3 },
    { label: 'No teto da meta (4,5%)', value: 4.5 },
    { label: 'Inflação alta (8%)', value: 8 },
]

// Widget `ipca-plus-simulator` (RC.3.4d): ano a ano, o saldo do Tesouro IPCA+
// separado em principal, correção da inflação e juros reais, com a inflação
// constante escolhida pelo aluno. Mostra que a taxa real se compõe com o IPCA
// (não se soma) e que o IR pesa sobre todo o ganho nominal.
export function IpcaPlusSimulatorWidget({ amount, realRatePct, years, ipcaPct }: IpcaPlusSimulatorWidgetProps) {
    const [real, setReal] = useState(realRatePct)
    const [term, setTerm] = useState(years)
    const [ipca, setIpca] = useState(ipcaPct)

    const rows = ipcaPlusYears(amount, real, ipca, term)
    const outcome = ipcaPlusOutcome(amount, real, ipca, term)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Taxa real: {pct(real)} ao ano, acima do IPCA
                    <input type="range" min={3} max={9} step={0.25} value={real} onChange={(e) => setReal(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Prazo: {term} {term === 1 ? 'ano' : 'anos'}
                    <input type="range" min={1} max={20} step={1} value={term} onChange={(e) => setTerm(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    IPCA por ano: {pct(ipca)}
                    <input type="range" min={0} max={12} step={0.25} value={ipca} onChange={(e) => setIpca(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.presets} role="group" aria-label="Cenários de inflação">
                {IPCA_PRESETS.map((preset) => (
                    <button
                        key={preset.label}
                        type="button"
                        className={styles.preset}
                        aria-pressed={ipca === preset.value}
                        onClick={() => setIpca(preset.value)}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <caption className={styles.visuallyHidden}>Evolução ano a ano de {formatCurrency(amount)} no Tesouro IPCA+</caption>
                    <thead>
                        <tr>
                            <th scope="col">Ano</th>
                            <th scope="col">Principal</th>
                            <th scope="col">Inflação</th>
                            <th scope="col">Juros reais</th>
                            <th scope="col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.year}>
                                <th scope="row">{row.year}</th>
                                <td>{formatCurrency(row.principal)}</td>
                                <td>{formatCurrency(row.inflation)}</td>
                                <td>{formatCurrency(row.realInterest)}</td>
                                <td>{formatCurrency(row.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={styles.result} aria-live="polite">
                <p>
                    Bruto no fim: {formatCurrency(outcome.gross)}. Imposto de renda sobre todo o ganho: {formatCurrency(outcome.ir)}.
                </p>
                <p className={styles.headline}>
                    Líquido: {formatCurrency(outcome.net)}, cerca de {pct(outcome.netAnnualPct)} ao ano.
                </p>
                <p>
                    Descontada a inflação, o rendimento real líquido é de cerca de {pct(outcome.realNetAnnualPct)} ao ano, abaixo dos{' '}
                    {pct(real)} anunciados.
                </p>
                <p>
                    Com a inflação constante, é uma projeção: a inflação real muda de ano para ano, e quem vende antes do vencimento recebe
                    o preço do dia.
                </p>
            </div>
        </div>
    )
}

export function ipcaPlusSimulatorSummary({ amount, realRatePct, years, ipcaPct }: IpcaPlusSimulatorWidgetProps): string {
    return `Projeção do Tesouro IPCA+ ano a ano para ${formatCurrency(amount)}: com taxa real de ${pct(realRatePct)}, IPCA de ${pct(ipcaPct)} ao ano e ${years} anos, separa principal, correção da inflação e juros reais, e mostra o líquido depois do imposto de renda.`
}
