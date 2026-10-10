export interface ReauthDialogProps {
    // Mensagem de erro da última tentativa (ex: senha incorreta).
    error?: string | null
    pending?: boolean
    onSubmit: (password: string) => void
    onCancel: () => void
}
