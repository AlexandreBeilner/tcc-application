export interface OrderSummaryRow {
    label: string
    value: string
    variant?: 'default' | 'total' | 'muted'
}

export interface OrderSummaryListProps {
    rows: OrderSummaryRow[]
}
