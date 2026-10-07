import { useState } from 'react'
import { formatMillions, formatPct, formatRatio, multiples } from '../../../features/lessons/widgets/companyMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { MultiplesCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { MultiplesCalculatorWidgetProps } from './types'

const toNumber = (raw: string) => {
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
}

// Widget `multiples-calculator` (RC.3.4f): lucro por ação, valor patrimonial por
// ação, P/L, P/VP, valor de mercado e rendimento do lucro (o inverso do P/L, para
// pôr ao lado da Selic). O preço é um controle deslizante: o aluno vê os múltiplos
// mexerem com o preço enquanto a empresa fica igual. Valores de exemplo.
export function MultiplesCalculatorWidget(props: MultiplesCalculatorWidgetProps) {
    const [price, setPrice] = useState(props.price)
    const [netIncome, setNetIncome] = useState(props.netIncome)
    const [equity, setEquity] = useState(props.equity)
    const [selic, setSelic] = useState(props.selicPct)

    const m = multiples(price, netIncome, equity, props.shares)

    return (
        <div className={styles.root}>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Preço da ação: {formatCurrency(price)}
                    <input type="range" min={5} max={60} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </label>
                <label className={styles.field}>
                    Lucro líquido de 12 meses (R$ mi)
                    <input
                        type="number"
                        step={10}
                        inputMode="decimal"
                        value={netIncome}
                        onChange={(e) => setNetIncome(toNumber(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Patrimônio líquido (R$ mi)
                    <input
                        type="number"
                        step={10}
                        inputMode="decimal"
                        value={equity}
                        onChange={(e) => setEquity(toNumber(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Selic de referência: {selic}% ao ano
                    <input type="range" min={2} max={16} step={0.5} value={selic} onChange={(e) => setSelic(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p>
                    A empresa tem {props.shares.toLocaleString('pt-BR')} milhões de ações. Valor de mercado de {formatMillions(m.marketCap)}
                    .
                </p>
                <p>
                    Lucro por ação de {formatCurrency(m.eps)} e valor patrimonial por ação de {formatCurrency(m.bookValuePerShare)}.
                </p>
                <p className={styles.headline}>
                    P/L de {formatRatio(m.pe)} e P/VP de {formatRatio(m.pb)}.
                </p>
                <p>
                    {m.pe === null
                        ? 'Sem lucro positivo, o P/L não faz sentido.'
                        : `O lucro de um ano paga ${formatPct(m.earningsYieldPct)} do preço, contra ${selic}% da Selic de referência.`}
                </p>
                <p>
                    Múltiplo baixo não quer dizer ação barata: o lucro pode ser pontual ou estar caindo. Compare com empresas do mesmo
                    setor.
                </p>
            </div>
        </div>
    )
}

export function multiplesCalculatorSummary({ price, netIncome, equity, shares }: MultiplesCalculatorWidgetProps): string {
    return `Calculadora de múltiplos: com preço de ${formatCurrency(price)}, lucro de ${formatMillions(netIncome)}, patrimônio de ${formatMillions(equity)} e ${shares.toLocaleString('pt-BR')} milhões de ações, calcula lucro por ação, valor patrimonial por ação, P/L, P/VP, valor de mercado e o rendimento do lucro.`
}
