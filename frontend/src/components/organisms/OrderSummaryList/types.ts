export interface OrderSummaryRow {
    label: string
    value: string
    variant?: 'default' | 'total' | 'muted'
    // Price-flash (identidade-visual-padroes.md §2, ~300-400ms, --color-gamify-500
    // a baixa opacidade) — o consumidor controla a janela de tempo (ex: efeito
    // que liga/desliga por 350ms a cada atualização de um valor assíncrono).
    flash?: boolean
}

export interface OrderSummaryListProps {
    rows: OrderSummaryRow[]
}
