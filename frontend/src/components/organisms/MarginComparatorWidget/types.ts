export interface CompanyMargins {
    netRevenue: number
    grossProfit: number
    ebit: number
    netIncome: number
}

export interface MarginComparatorWidgetProps {
    a: CompanyMargins
    b: CompanyMargins
}
