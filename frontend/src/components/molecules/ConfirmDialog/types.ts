import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
    title: string
    children: ReactNode
    confirmLabel: string
    cancelLabel?: string
    // Ação em andamento: trava os dois botões e troca o rótulo do confirmar.
    pending?: boolean
    pendingLabel?: string
    // Ação de maior risco: o botão de confirmar só habilita depois de o admin digitar
    // este texto exato (ticker, nome...), regra transversal 6 da Fase N.
    requireText?: string
    onConfirm: () => void
    onCancel: () => void
}
