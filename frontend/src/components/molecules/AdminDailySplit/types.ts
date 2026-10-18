import type { ReactNode } from 'react'

export interface AdminDailySplitProps {
    // Formulário aberto (criar ou editar); `null` = nenhum.
    form: ReactNode | null
    // A lista de itens.
    children: ReactNode
}
