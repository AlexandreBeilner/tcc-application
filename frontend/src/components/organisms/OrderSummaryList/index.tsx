import type { OrderSummaryListProps } from './types'
import styles from './index.module.css'

export type { OrderSummaryListProps, OrderSummaryRow } from './types'

// Lista de linhas rótulo/valor da tela 4.7 (Confirmação de Ordem, mockup
// vivo em identidade-visual-padroes.md §0) — genérica de propósito: as 3
// variações de ordem (compra/venda de renda variável, aporte de renda
// fixa, resgate) têm campos diferentes, mas todas se resumem a "rótulo à
// esquerda, valor tabular à direita", então a lista em si não precisa
// conhecer qual das 3 está sendo mostrada.
export function OrderSummaryList({ rows }: OrderSummaryListProps) {
    return (
        <div className={styles.list}>
            {rows.map((row) => (
                <div key={row.label} className={[styles.row, row.variant && styles[row.variant]].filter(Boolean).join(' ')}>
                    <span className={styles.label}>{row.label}</span>
                    <span className={[styles.value, 'tabular-nums', row.flash && styles.flash].filter(Boolean).join(' ')}>{row.value}</span>
                </div>
            ))}
        </div>
    )
}
