import type { AdminDailySplitProps } from './types'
import styles from './index.module.css'

export type { AdminDailySplitProps } from './types'

// Composição da lista de conteúdo do Diário com o formulário ao lado. Desktop (>= 1200px): lista à
// esquerda e formulário fixo à direita, para editar sem perder a lista de vista. Abaixo disso o
// formulário aberto aparece antes da lista.
export function AdminDailySplit({ form, children }: AdminDailySplitProps) {
    return (
        <div className={form ? `${styles.split} ${styles.withForm}` : styles.split}>
            {form && <div className={styles.form}>{form}</div>}
            <div className={styles.list}>{children}</div>
        </div>
    )
}
