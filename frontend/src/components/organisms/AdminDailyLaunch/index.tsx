import { useState } from 'react'
import { DAILY_STATUS_LABELS, describeDailyError, formatGameDate, formatNumbers } from '../../../features/admin/dailyAdmin'
import { ReauthCancelledError } from '../../../features/admin/AdminReauth'
import { usePrepareDailyDraftMutation, useSetDailyStartDateMutation } from '../../../features/admin/useAdminDaily'
import { Button } from '../../atoms/Button'
import { AdminField, adminInputClass } from '../../molecules/AdminField'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import type { AdminDailyLaunchProps } from './types'
import styles from './index.module.css'

export type { AdminDailyLaunchProps } from './types'

// Controle da estreia do Diário (DI.5.1, seção 3.5): ver o estado, preparar o rascunho de uma data,
// agendar, mudar a data enquanto futura e desligar. Depois que o jogo está no ar a data trava
// (mudar renumeraria jogos já jogados e compartilhados), então os controles somem.
export function AdminDailyLaunch({ overview }: AdminDailyLaunchProps) {
    const { status, start_date, can_change_start, reviewed_days_ahead, published_days_ahead, min_days_to_schedule } = overview
    const [date, setDate] = useState(start_date ?? '')
    const [confirming, setConfirming] = useState<'schedule' | 'off' | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<{ text: string; problems: string[] } | null>(null)
    const draft = usePrepareDailyDraftMutation()
    const setStart = useSetDailyStartDateMutation()
    const busy = draft.isPending || setStart.isPending

    function fail(err: unknown) {
        setNotice(null)
        if (err instanceof ReauthCancelledError) return setError({ text: 'Ação cancelada: senha não confirmada.', problems: [] })
        const { message, problems } = describeDailyError(err)
        setError({ text: message, problems })
    }

    function prepare() {
        setError(null)
        draft.mutate(date, {
            onSuccess: (result) => {
                const gaps =
                    result.warnings.length > 0 ? ` ${result.warnings.length} dia(s) ficaram sem jogo por falta de conteúdo no banco.` : ''
                setNotice(`Rascunho pronto a partir de ${formatGameDate(result.start_date)}: ${result.created} jogo(s) novo(s).${gaps}`)
            },
            onError: fail,
        })
    }

    function apply(next: string | null) {
        setError(null)
        setStart.mutate(next, {
            onSuccess: (result) => {
                setNotice(
                    next === null
                        ? 'Diário desligado. Nenhum jogo está no ar.'
                        : `Estreia agendada para ${formatGameDate(next)}. ${result.published.length} jogo(s) revisado(s) publicado(s): ${formatNumbers(result.published.slice(0, 5))}${result.published.length > 5 ? '…' : ''}`,
                )
            },
            onError: fail,
            onSettled: () => setConfirming(null),
        })
    }

    return (
        <section className={styles.root} aria-label="Estreia do Diário">
            <div className={styles.head}>
                <h2 className={styles.title}>Estreia</h2>
                <span className={status === 'off' ? `${styles.badge} ${styles.dashed}` : styles.badge}>{DAILY_STATUS_LABELS[status]}</span>
            </div>

            <p className={styles.line}>
                {status === 'off' && 'O Diário está desligado. A página pública mostra que o jogo ainda não começou.'}
                {status === 'scheduled' && start_date && `Estreia em ${formatGameDate(start_date)}. Até lá nenhuma rota de jogo responde.`}
                {status === 'live' && start_date && `No ar desde ${formatGameDate(start_date)}. A data de estreia não muda mais.`}
            </p>

            <dl className={styles.metrics}>
                <div>
                    <dt>Dias revisados seguidos</dt>
                    <dd>
                        {reviewed_days_ahead}
                        {status !== 'live' && <span className={styles.of}> de {min_days_to_schedule} necessários</span>}
                    </dd>
                </div>
                <div>
                    <dt>Dias publicados seguidos</dt>
                    <dd>{published_days_ahead}</dd>
                </div>
            </dl>

            {can_change_start ? (
                <div className={styles.form}>
                    <AdminField label="Data de estreia" hint="O jogo #1 é o desta data. O dia vira às 21h de Brasília (00:00 UTC).">
                        {(id) => (
                            <input
                                id={id}
                                type="date"
                                className={adminInputClass}
                                value={date}
                                disabled={busy}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        )}
                    </AdminField>
                    <div className={styles.actions}>
                        <Button variant="secondary" disabled={busy || date === ''} onClick={prepare}>
                            {draft.isPending ? 'Preparando…' : 'Preparar rascunho'}
                        </Button>
                        <Button disabled={busy || date === ''} onClick={() => setConfirming('schedule')}>
                            {status === 'scheduled' ? 'Mudar a data' : 'Agendar estreia'}
                        </Button>
                        {status === 'scheduled' && (
                            <Button variant="secondary" disabled={busy} onClick={() => setConfirming('off')}>
                                Desligar
                            </Button>
                        )}
                    </div>
                    <p className={styles.hint}>
                        Primeiro prepare o rascunho dos 30 dias, depois revise cada jogo. Agendar exige {min_days_to_schedule} dias seguidos
                        revisados a partir da data.
                    </p>
                </div>
            ) : null}

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <div className={styles.error} role="alert">
                    <p>{error.text}</p>
                    {error.problems.length > 0 && (
                        <ul>
                            {error.problems.map((problem) => (
                                <li key={problem}>{problem}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {confirming === 'schedule' && (
                <ConfirmDialog
                    title={status === 'scheduled' ? 'Mudar a data de estreia?' : 'Agendar a estreia?'}
                    confirmLabel={status === 'scheduled' ? 'Mudar a data' : 'Agendar'}
                    pendingLabel="Agendando…"
                    pending={setStart.isPending}
                    onConfirm={() => apply(date)}
                    onCancel={() => setConfirming(null)}
                >
                    <p>
                        O Diário estreia em <strong>{formatGameDate(date)}</strong>, com o jogo #1 nesse dia.
                    </p>
                    <p>
                        Os jogos já revisados são publicados agora, em lote. O que ainda não foi revisado continua fora do ar. Depois da
                        estreia a data não muda mais.
                    </p>
                </ConfirmDialog>
            )}
            {confirming === 'off' && (
                <ConfirmDialog
                    title="Desligar o Diário?"
                    confirmLabel="Desligar"
                    pendingLabel="Desligando…"
                    pending={setStart.isPending}
                    onConfirm={() => apply(null)}
                    onCancel={() => setConfirming(null)}
                >
                    <p>A estreia deixa de estar agendada e todos os jogos saem do ar. A revisão feita é mantida.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
