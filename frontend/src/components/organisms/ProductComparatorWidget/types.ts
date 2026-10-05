export interface ComparedProduct {
    name: string
    annualRatePct: number
    taxExempt: boolean
    liquidity?: string
    fgc?: string
}

export interface ProductComparatorWidgetProps {
    products: ComparedProduct[]
    amount: number
    days: number
}
