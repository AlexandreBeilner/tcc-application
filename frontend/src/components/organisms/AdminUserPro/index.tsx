import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import {
    MAX_CORRECTION_REASON_LENGTH,
    MAX_PRO_GRANT_DAYS,
    describeProGrantError,
    parseGrantDays,
    planSummary,
} from '../../../features/admin/adminUsers'
import { formatDateTime } from '../../../features/admin/timeFormat'
import { useGrantUserProMutation, useUserProQuery } from '../../../features/admin/useUserPro'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import type { AdminUserProProps } from './types'
import styles from './index.module.css'

export type { AdminUserProProps } from './types'

export const MIN_PRO_GRANT_REASON_LENGTH = 5

// Plano PRO e concessão promocional (MO.2.5). A concessão empilha depois do acesso atual, vai de 1
// a 90 dias, exige motivo e pede a senha de novo se a conferência recente venceu. Fica tudo na
// auditoria (`billing.grant_promotional`). Não há revogação pelo painel nesta fase.
export function AdminUserPro({ userId, username }: AdminUserProProps) {
    const query = useUserProQuery(userId)
    const grant = useGrantUserProMutation()
    const daysId = useId()
    const reasonId = useId()

    const [days, setDays] = useState('')
    const [reason, setReason] = useState('')
    const [confirming, setConfirming] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const parsedDays = parseGrantDays(days)
    const validReason = reason.trim().length >= MIN_PRO_GRANT_REASON_LENGTH
    const canSubmit = parsedDays !== null && validReason && !grant.isPending && query.isSuccess
    const status = query.data

    function submit(event: SubmitEvent) {
        event.preventDefault()
        if (canSubmit) setConfirming(true)
    }

    function run() {
        if (parsedDays === null) return
        setDialogError(null)
        grant.mutate(
            { userId, days: parsedDays, reason: reason.trim() },
            {
                onSuccess: (result) => {
                    setNotice(`PRO concedido a @${username} até ${formatDateTime(result.ends_at)}.`)
                    setDays('')
                    setReason('')
                    setConfirming(false)
                },
                onError: (err) => setDialogError(describeProGrantError(err)),
            },
        )
    }

    return (
        <section className={styles.root} aria-labelledby="admin-user-pro-title">
            <h2 id="admin-user-pro-title" className={styles.title}>
                Plano PRO
            </h2>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}

            <div className={styles.grid}>
                <div className={styles.card} role="group" aria-label="Plano atual">
                    <h3 className={styles.cardTitle}>Plano atual</h3>
                    {query.isLoading && <p className={styles.hint}>Carregando plano…</p>}
                    {query.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar o plano desta pessoa.
                        </p>
                    )}
                    {status && (
                        <>
                            <p className={styles.status}>{planSummary(status)}</p>
                            <p className={styles.hint}>
                                {status.expires_at
                                    ? `Acesso até ${formatDateTime(status.expires_at)}.`
                                    : 'Sem data de vencimento registrada.'}
                            </p>
                        </>
                    )}
                </div>

                <form className={styles.card} aria-label="Conceder PRO" onSubmit={submit}>
                    <h3 className={styles.cardTitle}>Conceder PRO promocional</h3>
                    <p className={styles.hint}>
                        Soma dias de PRO depois do fim do acesso atual, sem encurtar nada. De 1 a {MAX_PRO_GRANT_DAYS} dias por concessão;
                        para mais, conceda de novo. Não dá para revogar pelo painel.
                    </p>
                    <label htmlFor={daysId} className={styles.field}>
                        <span>Dias de PRO</span>
                        <input
                            id={daysId}
                            className={styles.input}
                            inputMode="numeric"
                            placeholder="30"
                            value={days}
                            disabled={grant.isPending}
                            onChange={(event) => setDays(event.target.value)}
                        />
                    </label>
                    <label htmlFor={reasonId} className={styles.field}>
                        <span>Motivo</span>
                        <input
                            id={reasonId}
                            className={styles.input}
                            value={reason}
                            maxLength={MAX_CORRECTION_REASON_LENGTH}
                            disabled={grant.isPending}
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </label>
                    <button type="submit" className={styles.submit} disabled={!canSubmit}>
                        Conceder PRO
                    </button>
                </form>
            </div>

            {confirming && parsedDays !== null && (
                <ConfirmDialog
                    title="Conceder PRO a esta conta?"
                    confirmLabel="Conceder"
                    pendingLabel="Concedendo…"
                    pending={grant.isPending}
                    onConfirm={run}
                    onCancel={() => {
                        setConfirming(false)
                        setDialogError(null)
                    }}
                >
                    <p>
                        Você vai conceder{' '}
                        <strong>
                            {parsedDays} {parsedDays === 1 ? 'dia' : 'dias'}
                        </strong>{' '}
                        de PRO a @{username}, contados depois do fim do acesso atual.
                    </p>
                    <p>A concessão não pode ser desfeita pelo painel e fica registrada na auditoria com o motivo.</p>
                    {dialogError && (
                        <p role="alert" className={styles.error}>
                            {dialogError}
                        </p>
                    )}
                </ConfirmDialog>
            )}
        </section>
    )
}
