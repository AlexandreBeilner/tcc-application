import { useState } from 'react'
import { dupont, formatMillions, formatPct, formatRatio } from '../../../features/lessons/widgets/companyMath'
import type { RoeLabWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { RoeLabWidgetProps } from './types'

// Widget `roe-lab` (RC.3.4f): o ROE decomposto em margem líquida, giro do ativo
// e alavancagem (DuPont). O aluno mexe na parte do ativo financiada por dívida,
// com o lucro fixo, e vê o ROE subir só porque o patrimônio encolheu. A Selic
// de referência é um exemplo, editável, para comparar com a renda fixa.
export function RoeLabWidget({ revenue, netIncome, assets, equity, selicPct }: RoeLabWidgetProps) {
    const initialDebtPct = Math.min(95, Math.max(0, Math.round(((assets - equity) / assets) * 100)))
    const [debtPct, setDebtPct] = useState(initialDebtPct)
    const [selic, setSelic] = useState(selicPct)

    const currentEquity = assets * (1 - debtPct / 100)
    const d = dupont(revenue, netIncome, assets, currentEquity)
    const premium = d.roePct === null ? null : d.roePct - selic

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Parte do ativo financiada por dívida: {debtPct}%
                    <input type="range" min={0} max={95} step={5} value={debtPct} onChange={(e) => setDebtPct(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Selic de referência: {selic}% ao ano
                    <input type="range" min={2} max={16} step={0.5} value={selic} onChange={(e) => setSelic(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p>
                    Receita de {formatMillions(revenue)}, lucro líquido de {formatMillions(netIncome)} e ativo de {formatMillions(assets)}.
                    Patrimônio líquido de {formatMillions(currentEquity)}.
                </p>
                <p className={styles.headline}>ROE de {formatPct(d.roePct)}.</p>
                <p>
                    ROE = margem líquida de {formatPct(d.marginPct)} x giro do ativo de {formatRatio(d.turnover)} x alavancagem de{' '}
                    {formatRatio(d.leverage)}.
                </p>
                {premium !== null && (
                    <p>
                        {premium >= 0
                            ? `O ROE fica ${premium.toFixed(1).replace('.', ',')} ponto acima da Selic de referência.`
                            : `O ROE fica ${Math.abs(premium).toFixed(1).replace('.', ',')} ponto abaixo da Selic de referência.`}
                    </p>
                )}
                {debtPct > initialDebtPct && (
                    <p>O lucro é o mesmo: o ROE subiu porque a empresa passou a usar mais dívida, e o risco subiu junto.</p>
                )}
            </div>
        </div>
    )
}

export function roeLabSummary({ revenue, netIncome, assets, equity }: RoeLabWidgetProps): string {
    return `Laboratório de ROE: com receita de ${formatMillions(revenue)}, lucro de ${formatMillions(netIncome)}, ativo de ${formatMillions(assets)} e patrimônio de ${formatMillions(equity)}, decompõe o ROE em margem, giro e alavancagem, e mostra o efeito de usar mais dívida.`
}
