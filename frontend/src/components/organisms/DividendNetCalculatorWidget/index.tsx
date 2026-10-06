import { useState } from 'react'
import {
    DIVIDEND_MONTHLY_THRESHOLD,
    DIVIDEND_WITHHOLDING_PCT,
    JCP_WITHHOLDING_PCT,
    proventoNet,
} from '../../../features/lessons/widgets/proventosMath'
import type { ProventoKind, ProventoNetResult } from '../../../features/lessons/widgets/proventosMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { DividendNetCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { DividendNetCalculatorWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(1).replace('.', ',').replace(',0', '')}%`

const RULE_TEXT: Record<ProventoNetResult['ruleKey'], string> = {
    'dividend-exempt-legacy': 'Lucro apurado até 2025 e aprovado até 31/12/2025: dividendo isento, sem retenção.',
    'dividend-below-threshold': `Dividendo: de 2026 em diante só há retenção quando o total pago pela mesma empresa no mês passa de ${formatCurrency(DIVIDEND_MONTHLY_THRESHOLD)}. Abaixo disso, não há retenção.`,
    'dividend-above-threshold': `Dividendo: o total do mês passou de ${formatCurrency(DIVIDEND_MONTHLY_THRESHOLD)}, então a empresa retém ${pct(DIVIDEND_WITHHOLDING_PCT)} na fonte.`,
    jcp: `JCP (juros sobre capital próprio): a empresa retém ${pct(JCP_WITHHOLDING_PCT)} na fonte, sempre.`,
}

// Widget `dividend-net-calculator` (RC.3.4g): quanto cai na conta de um provento depois do imposto
// retido. Dividendo e JCP têm regras diferentes; as alíquotas e o limite de R$ 50 mil são de 2026 e
// espelham os fatos da lei. O imposto mínimo para rendas muito altas não entra nesta conta.
export function DividendNetCalculatorWidget(props: DividendNetCalculatorWidgetProps) {
    const [quantity, setQuantity] = useState(props.quantity)
    const [valuePerShare, setValuePerShare] = useState(props.valuePerShare)
    const [kind, setKind] = useState<ProventoKind>(props.kind)
    const [other, setOther] = useState(props.otherSameMonth)
    const [legacy, setLegacy] = useState(false)

    const result = proventoNet({ kind, quantity, valuePerShare, otherSameMonth: other, resultsUntil2025: legacy })

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Tipo de provento">
                <button type="button" className={styles.preset} aria-pressed={kind === 'dividend'} onClick={() => setKind('dividend')}>
                    Dividendo
                </button>
                <button type="button" className={styles.preset} aria-pressed={kind === 'jcp'} onClick={() => setKind('jcp')}>
                    JCP
                </button>
            </div>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Quantidade de ações
                    <input
                        type="number"
                        min={1}
                        max={1_000_000}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    />
                </label>
                <label className={styles.field}>
                    Valor por ação (R$)
                    <input
                        type="number"
                        min={0.01}
                        max={1000}
                        step={0.01}
                        value={valuePerShare}
                        onChange={(e) => setValuePerShare(Math.max(0.01, Number(e.target.value)))}
                    />
                </label>
                <label className={styles.field}>
                    Outros proventos da mesma empresa no mês: {formatCurrency(other)}
                    <input
                        type="range"
                        min={0}
                        max={200_000}
                        step={5000}
                        value={other}
                        onChange={(e) => setOther(Number(e.target.value))}
                    />
                </label>
            </div>
            {kind === 'dividend' && (
                <label className={styles.field}>
                    <span>
                        <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} /> Lucro apurado até 2025 e
                        aprovado até 31/12/2025
                    </span>
                </label>
            )}
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Bruto {formatCurrency(result.gross)}, retido {formatCurrency(result.withheld)} ({pct(result.withholdingPct)}), líquido{' '}
                    {formatCurrency(result.net)}.
                </p>
                <p>{RULE_TEXT[result.ruleKey]}</p>
                <p>
                    Total do mês na mesma empresa: {formatCurrency(result.monthlyTotal)}. O imposto mínimo para rendas muito altas não entra
                    nesta conta.
                </p>
            </div>
        </div>
    )
}

export function dividendNetCalculatorSummary({ quantity, valuePerShare, kind }: DividendNetCalculatorWidgetProps): string {
    return `Calculadora de provento líquido: para ${quantity} ações a ${formatCurrency(valuePerShare)}, mostra o valor bruto, o imposto retido e o líquido de ${kind === 'jcp' ? 'JCP' : 'dividendo'}, com a regra de 2026 aplicada.`
}
