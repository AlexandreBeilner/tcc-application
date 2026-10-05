export interface SuspendUserDialogProps {
    username: string
    pending?: boolean
    // Mensagem da última tentativa recusada (ex: conta já suspensa).
    error?: string | null
    onConfirm: (reason: string) => void
    onCancel: () => void
}
