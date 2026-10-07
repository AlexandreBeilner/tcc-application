export interface EquityTaxCalculatorWidgetProps {
    kind: 'swing' | 'daytrade'
    assetClass: 'stock' | 'etf' | 'fii'
    salesMonth: number
    profit: number
    lossCarry: number
}
