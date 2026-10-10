import { useState } from 'react'
import { dividendTimelineResult } from '../../../features/lessons/widgets/proventosMath'
import type { DividendSide } from '../../../features/lessons/widgets/proventosMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { DividendTimelineWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { DividendTimelineWidgetProps } from './types'

// Widget `dividend-timeline` (RC.3.4g): a linha do tempo de um provento com quatro marcos
// (anúncio, data com, data ex, pagamento). O aluno escolhe se compra ou se vende e em que dia
// útil, e vê se recebe. Os dias são dias úteis contados a partir do anúncio (dia 0). A data ex
// é sempre o dia útil seguinte à data com. O resultado vem escrito, nunca só marcado por cor.
export function DividendTimelineWidget({ quantity, valuePerShare, comDay, paymentDay }: DividendTimelineWidgetProps) {
    const exDay = comDay + 1
    const lastDay = paymentDay + 2
    const [side, setSide] = useState<DividendSide>('buy')
    const [day, setDay] = useState(comDay)

    const result = dividendTimelineResult(side, day, comDay, quantity, valuePerShare)
    const marks = [
        { day: 0, label: 'Anúncio' },
        { day: comDay, label: 'Data com' },
        { day: exDay, label: 'Data ex' },
        { day: paymentDay, label: 'Pagamento' },
    ]

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="O que você faz">
                <button type="button" className={styles.preset} aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>
                    Eu compro a ação
                </button>
                <button type="button" className={styles.preset} aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>
                    Eu já tenho e vendo
                </button>
            </div>
            <ol className={styles.milestones} aria-label="Marcos do provento, em dias úteis">
                {marks.map((mark) => (
                    <li key={mark.label} className={styles.milestone}>
                        <strong>{mark.label}</strong>
                        <span>dia {mark.day}</span>
                    </li>
                ))}
            </ol>
            <label className={styles.field}>
                {side === 'buy' ? 'Dia da compra' : 'Dia da venda'}: dia {day}
                <input type="range" min={0} max={lastDay} step={1} value={day} onChange={(e) => setDay(Number(e.target.value))} />
            </label>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {result.receives
                        ? `Você recebe ${formatCurrency(result.gross)} (${quantity} ações a ${formatCurrency(valuePerShare)} cada).`
                        : 'Você não recebe este provento.'}
                </p>
                <p>
                    {side === 'buy'
                        ? `O direito é de quem está com a ação no fim da data com (dia ${comDay}). Comprar até esse dia dá o direito; comprar na data ex (dia ${exDay}) ou depois, não.`
                        : `Quem já tinha a ação no fim da data com (dia ${comDay}) tem o direito, mesmo que venda depois. Vender até a data com tira o direito; vender na data ex ou depois, não.`}
                </p>
                <p>
                    Na data ex o preço da ação costuma descontar o valor do provento, cerca de {formatCurrency(result.priceDropPerShare)}{' '}
                    por ação aqui. O provento não é dinheiro extra: parte do valor da empresa sai para o bolso do acionista.
                </p>
                <p>O pagamento cai no dia {paymentDay}, depois de a data ex já ter passado.</p>
            </div>
        </div>
    )
}

export function dividendTimelineSummary({ quantity, valuePerShare, comDay }: DividendTimelineWidgetProps): string {
    return `Linha do tempo de um provento: anúncio, data com no dia ${comDay}, data ex no dia seguinte e pagamento. Escolha comprar ou vender em cada dia e veja se as ${quantity} ações a ${formatCurrency(valuePerShare)} dão direito ao provento.`
}
