export interface DividendNetCalculatorWidgetProps {
    quantity: number
    valuePerShare: number
    kind: 'dividend' | 'jcp'
    otherSameMonth: number
}
