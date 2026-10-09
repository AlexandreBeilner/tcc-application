import { useState } from 'react'
import type { TickerDecoderWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { TickerDecoderWidgetProps } from './types'

type Kind = 'on' | 'pn' | 'fund' | 'fractional'

const KIND_LABEL: Record<Kind, string> = {
    on: 'Ordinária (ON)',
    pn: 'Preferencial (PN)',
    fund: 'Fundo, ETF ou unit',
    fractional: 'Mercado fracionário',
}

interface TickerItem {
    ticker: string
    kind: Kind
    reason: string
}

// Convenção da B3: quatro letras para o emissor e o número final para o tipo;
// o F no fim indica o mercado fracionário (menos de 100 ações). Tickers do
// catálogo de exemplo, sem empresas reais.
export const TICKER_ITEMS: TickerItem[] = [
    { ticker: 'VALR3', kind: 'on', reason: 'Final 3: ação ordinária, com direito a voto.' },
    { ticker: 'BNDD4', kind: 'pn', reason: 'Final 4: ação preferencial, com prioridade em dividendos e, em geral, sem voto.' },
    { ticker: 'SINT11', kind: 'fund', reason: 'Final 11: fundo, ETF ou unit, e não uma ação simples.' },
    { ticker: 'VALR3F', kind: 'fractional', reason: 'O F no fim é o mercado fracionário: de 1 a 99 ações, o lote padrão é de 100.' },
    { ticker: 'BNDD3', kind: 'on', reason: 'Final 3: ordinária. É do mesmo emissor que BNDD4, só que com voto.' },
    { ticker: 'TJLO11', kind: 'fund', reason: 'Final 11: fundo, ETF ou unit.' },
]

// Widget `ticker-decoder` (RC.3.4e): para cada ticker o aluno escolhe o que ele
// é, e a regra aparece depois da resposta. Botões em vez de arrastar, para
// funcionar em teclado e toque.
export function TickerDecoderWidget(_props: TickerDecoderWidgetProps) {
    const [answers, setAnswers] = useState<Record<string, Kind>>({})
    const answered = Object.keys(answers).length
    const correct = TICKER_ITEMS.filter((item) => answers[item.ticker] === item.kind).length

    return (
        <div className={styles.root}>
            <ul className={styles.productList}>
                {TICKER_ITEMS.map((item) => {
                    const answer = answers[item.ticker]
                    return (
                        <li key={item.ticker} className={styles.productItem}>
                            <p className={styles.headline}>{item.ticker}</p>
                            <div className={styles.presets} role="group" aria-label={`O que é ${item.ticker}?`}>
                                {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        className={styles.preset}
                                        aria-pressed={answer === kind}
                                        onClick={() => setAnswers((prev) => ({ ...prev, [item.ticker]: kind }))}
                                    >
                                        {KIND_LABEL[kind]}
                                    </button>
                                ))}
                            </div>
                            {answer !== undefined && (
                                <p aria-live="polite">
                                    {answer === item.kind ? 'Certo. ' : `Não é isso, é ${KIND_LABEL[item.kind]}. `}
                                    {item.reason}
                                </p>
                            )}
                        </li>
                    )
                })}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p>
                    {answered === 0
                        ? 'Escolha o que cada ticker é.'
                        : `Você acertou ${correct} de ${answered} ${answered === 1 ? 'resposta' : 'respostas'}.`}
                </p>
            </div>
        </div>
    )
}

export function tickerDecoderSummary(_props: TickerDecoderWidgetProps): string {
    return `Decodificador de ticker: ${TICKER_ITEMS.length} códigos (${TICKER_ITEMS.map((i) => i.ticker).join(', ')}) para classificar como ordinária, preferencial, fundo ou mercado fracionário, com a regra mostrada depois da resposta.`
}
