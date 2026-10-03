import { useEffect, useId, useRef } from 'react'
import { Button } from '../../atoms/Button'
import type { ConfirmDialogProps } from './types'
import styles from './index.module.css'

export type { ConfirmDialogProps } from './types'

// Confirmação genérica de ação importante do painel admin (Fase N): modal
// central (bottom sheet no mobile, mesmo padrão visual de
// `OrderConfirmationDialog`), fecha por Esc, clique no fundo ou "Cancelar" —
// nunca durante a execução (`pending`). O foco abre em "Cancelar": a opção
// segura é a que o Enter aciona sem querer.
export function ConfirmDialog({
    title,
    children,
    confirmLabel,
    cancelLabel = 'Cancelar',
    pending = false,
    pendingLabel = 'Executando…',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const titleId = useId()
    const cancelRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        cancelRef.current?.focus()
    }, [])

    useEffect(() => {
        if (pending) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [pending, onCancel])

    return (
        <div className={styles.backdrop} data-testid="confirm-backdrop" onClick={pending ? undefined : onCancel}>
            <div
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id={titleId} className={styles.title}>
                    {title}
                </h2>
                <div className={styles.body}>{children}</div>
                <div className={styles.actions}>
                    <button ref={cancelRef} type="button" className={styles.cancel} disabled={pending} onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <Button onClick={onConfirm} disabled={pending}>
                        {pending ? pendingLabel : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}
