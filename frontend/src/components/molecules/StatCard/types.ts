import type { ReactNode } from 'react'

export interface StatCardProps {
    title: string
    // Leva à tela da seção; sem `to` o cartão não é link.
    to?: string
    linkLabel?: string
    // Quando a fonte do cartão falhou: mostra o motivo no lugar dos números.
    unavailable?: string
    children?: ReactNode
}
