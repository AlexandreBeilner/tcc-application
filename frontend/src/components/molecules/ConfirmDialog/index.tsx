import { useEffect, useId, useRef, useState } from 'react'
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
    requireText,
    confirmDisabled = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const titleId = useId()
    const cancelRef = useRef<HTMLButtonElement>(null)
    const inputId = useId()
    const [typed, setTyped] = useState('')
    const confirmBlocked = requireText !== undefined && typed.trim() !== requireText

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
                {requireText !== undefined && (
                    <label htmlFor={inputId} className={styles.requireText}>
                        <span>
                            Para confirmar, digite <strong>{requireText}</strong>
                        </span>
                        <input
                            id={inputId}
                            className={styles.requireInput}
                            value={typed}
                            autoComplete="off"
                            disabled={pending}
                            onChange={(event) => setTyped(event.target.value)}
                        />
                    </label>
                )}
                <div className={styles.actions}>
                    <button ref={cancelRef} type="button" className={styles.cancel} disabled={pending} onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <Button onClick={onConfirm} disabled={pending || confirmBlocked || confirmDisabled}>
                        {pending ? pendingLabel : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}
