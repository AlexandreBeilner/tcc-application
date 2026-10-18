import type { ReactNode } from 'react'

export interface AdminFieldProps {
    label: string
    hint?: string
    // Recebe o `id` do controle, para o `label` apontar para ele.
    children: (id: string) => ReactNode
}
