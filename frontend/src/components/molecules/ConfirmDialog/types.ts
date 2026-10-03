import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
    title: string
    children: ReactNode
    confirmLabel: string
    cancelLabel?: string
    // Ação em andamento: trava os dois botões e troca o rótulo do confirmar.
    pending?: boolean
    pendingLabel?: string
    onConfirm: () => void
    onCancel: () => void
}
