import { useState } from 'react'
import { EXEMPT_MONTHLY_SALES, darfAmount, equityTax } from '../../../features/lessons/widgets/equityTaxMath'
import type { AssetClass, EquityTaxRule, TradeKind } from '../../../features/lessons/widgets/equityTaxMath'
import { formatCurrency } from '../../../features/portfolio/format'
import type { EquityTaxCalculatorWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { EquityTaxCalculatorWidgetProps } from './types'

const RULE_TEXT: Record<EquityTaxRule, string> = {
    loss: 'Mês com prejuízo: não há imposto, e o prejuízo fica guardado para abater lucros futuros do mesmo tipo de operação.',
    exempt: `Vendas de ações no mês em até ${formatCurrency(EXEMPT_MONTHLY_SALES)}: o ganho é isento. Conta o valor vendido, não o lucro.`,
    compensated: 'O prejuízo de meses anteriores abate o lucro antes de calcular o imposto.',
    taxed: 'Sem isenção: o imposto incide sobre o lucro do mês.',
}

const ASSET_LABEL: Record<AssetClass, string> = { stock: 'Ação', etf: 'ETF', fii: 'FII' }
const KIND_LABEL: Record<TradeKind, string> = { swing: 'Swing trade (outro dia)', daytrade: 'Day trade (mesmo dia)' }

const pct = (value: number) => `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')}%`

// Widget `equity-tax-calculator` (RC.4.7): imposto sobre a venda no mês, com a isenção
// de R$ 20 mil só para ações, a alíquota por tipo de operação, a compensação de
// prejuízo e o dedo-duro. Valores de exemplo; não substitui o programa da Receita.
export function EquityTaxCalculatorWidget(props: EquityTaxCalculatorWidgetProps) {
    const [kind, setKind] = useState<TradeKind>(props.kind)
    const [assetClass, setAssetClass] = useState<AssetClass>(props.assetClass)
    const [sales, setSales] = useState(props.salesMonth)
    const [profit, setProfit] = useState(props.profit)
    const [loss, setLoss] = useState(props.lossCarry)

    const result = equityTax({ kind, assetClass, salesMonth: sales, profit, lossCarry: loss })
    const darf = darfAmount(result)

    return (
        <div className={styles.root}>
            <div className={styles.presets} role="group" aria-label="Tipo de operação">
                {(Object.keys(KIND_LABEL) as TradeKind[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        className={styles.preset}
                        aria-pressed={kind === value}
                        onClick={() => setKind(value)}
                    >
                        {KIND_LABEL[value]}
                    </button>
                ))}
            </div>
            <div className={styles.presets} role="group" aria-label="Classe do ativo">
                {(Object.keys(ASSET_LABEL) as AssetClass[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        className={styles.preset}
                        aria-pressed={assetClass === value}
                        onClick={() => setAssetClass(value)}
                    >
                        {ASSET_LABEL[value]}
                    </button>
                ))}
            </div>
            <div className={styles.fields}>
                <label className={styles.field}>
                    Total vendido no mês: {formatCurrency(sales)}
                    <input
                        type="range"
                        min={0}
                        max={100_000}
                        step={1000}
                        value={sales}
                        onChange={(e) => setSales(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Lucro (ou prejuízo) do mês: {formatCurrency(profit)}
                    <input
                        type="range"
                        min={-10_000}
                        max={20_000}
                        step={500}
                        value={profit}
                        onChange={(e) => setProfit(Number(e.target.value))}
                    />
                </label>
                <label className={styles.field}>
                    Prejuízo de meses anteriores: {formatCurrency(loss)}
                    <input type="range" min={0} max={10_000} step={500} value={loss} onChange={(e) => setLoss(Number(e.target.value))} />
                </label>
            </div>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    {result.rule === 'exempt' || result.tax === 0
                        ? 'Imposto devido: R$ 0,00.'
                        : `Imposto devido: ${formatCurrency(result.tax)} (${pct(result.ratePct)} sobre ${formatCurrency(result.taxableBase)}).`}
                </p>
                <p>{RULE_TEXT[result.rule]}</p>
                {result.tax > 0 && (
                    <p>
                        DARF a pagar: {formatCurrency(darf)}, até o último dia útil do mês seguinte
                        {result.withholding > 0 ? `, já descontado o dedo-duro de ${formatCurrency(result.withholding)}` : ''}.
                    </p>
                )}
                {result.lossCarryAfter > 0 && <p>Prejuízo a compensar nos próximos meses: {formatCurrency(result.lossCarryAfter)}.</p>}
            </div>
        </div>
    )
}

export function equityTaxCalculatorSummary(_props: EquityTaxCalculatorWidgetProps): string {
    return 'Calculadora de imposto sobre vendas em renda variável: você escolhe swing trade ou day trade, a classe do ativo, o total vendido, o lucro e o prejuízo anterior, e vê se o ganho é isento, o imposto devido e o valor do DARF.'
}
