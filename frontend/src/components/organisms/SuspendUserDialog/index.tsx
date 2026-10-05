import { useId, useState } from 'react'
import { MAX_SUSPEND_REASON_LENGTH, MIN_SUSPEND_REASON_LENGTH } from '../../../features/admin/adminUsers'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import type { SuspendUserDialogProps } from './types'
import styles from './index.module.css'

export type { SuspendUserDialogProps } from './types'

// Suspensão de conta (N.16): o motivo é obrigatório porque vai pro log de auditoria e
// pra linha do tempo da conta. Reusa o `ConfirmDialog`; o botão só habilita com motivo
// válido (o backend valida de novo).
export function SuspendUserDialog({ username, pending = false, error, onConfirm, onCancel }: SuspendUserDialogProps) {
    const [reason, setReason] = useState('')
    const fieldId = useId()
    const trimmed = reason.trim()
    const valid = trimmed.length >= MIN_SUSPEND_REASON_LENGTH

    return (
        <ConfirmDialog
            title="Suspender esta conta?"
            confirmLabel="Suspender conta"
            pendingLabel="Suspendendo…"
            pending={pending}
            confirmDisabled={!valid}
            onConfirm={() => valid && onConfirm(trimmed)}
            onCancel={onCancel}
        >
            <p>
                @{username} deixa de entrar, perde as sessões abertas e sai do ranking e da busca de amigos. Nada do progresso é apagado e a
                suspensão é reversível.
            </p>
            <p>As ordens em repouso não são canceladas. Use a tela de Ordens se for preciso.</p>
            <label htmlFor={fieldId} className={styles.field}>
                <span>Motivo (fica no registro de auditoria)</span>
                <textarea
                    id={fieldId}
                    className={styles.input}
                    rows={3}
                    maxLength={MAX_SUSPEND_REASON_LENGTH}
                    value={reason}
                    disabled={pending}
                    onChange={(event) => setReason(event.target.value)}
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
