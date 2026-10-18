export interface FormulaWalkthroughItem {
    label: string
    formula: string
    legend?: string
    numbers: string
    result: string
}

export interface FormulaWalkthroughProps {
    intro?: string
    items: FormulaWalkthroughItem[]
    note?: string
}
