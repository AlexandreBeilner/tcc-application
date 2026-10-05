import { useId, useState } from 'react'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import type { ReauthDialogProps } from './types'
import styles from './index.module.css'

export type { ReauthDialogProps } from './types'

// Pede a senha de novo antes de uma ação destrutiva do painel (N.22). Reusa o
// `ConfirmDialog` (mesmo modal, foco em "Cancelar"); Enter no campo confirma.
export function ReauthDialog({ error, pending = false, onSubmit, onCancel }: ReauthDialogProps) {
    const [password, setPassword] = useState('')
    const inputId = useId()
    const submit = () => {
        if (password !== '') onSubmit(password)
    }

    return (
        <ConfirmDialog
            title="Confirme sua senha"
            confirmLabel="Confirmar"
            pending={pending}
            pendingLabel="Conferindo…"
            onConfirm={submit}
            onCancel={onCancel}
        >
            <p>Esta ação é sensível. Digite sua senha de administrador para continuar.</p>
            <label htmlFor={inputId} className={styles.field}>
                <span>Senha</span>
                <input
                    id={inputId}
                    type="password"
                    className={styles.input}
                    value={password}
                    autoComplete="current-password"
                    disabled={pending}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') submit()
                    }}
                />
            </label>
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
        </ConfirmDialog>
    )
}
