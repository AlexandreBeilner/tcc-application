import { useState } from 'react'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { Pagination } from '../../components/molecules/Pagination'
import { SchedulerPanel } from '../../components/organisms/SchedulerPanel'
import { TickRunList } from '../../components/organisms/TickRunList'
import { useAdvanceTicksMutation, useSetSchedulerPausedMutation, useTriggerTickMutation } from '../../features/admin/useSchedulerActions'
import { useSchedulerQuery } from '../../features/admin/useSchedulerQuery'
import { useTicksQuery } from '../../features/admin/useTicksQuery'
import { ApiError } from '../../services/client'
import styles from './index.module.css'

type Pending = { kind: 'tick' } | { kind: 'advance'; days: number } | null

// Mensagens fixas por situação conhecida; qualquer outro erro vira o genérico.
function describeError(err: unknown, partialTicks?: number): string {
    if (err instanceof ApiError) {
        if (err.status === 409)
            return 'Já existe um tick em andamento (ou a agenda está desligada neste ambiente). Tente de novo em instantes.'
        if (err.status === 500 && partialTicks !== undefined && partialTicks > 0) {
            return `Falhou no meio: ${partialTicks} dia(s) já rodaram e ficam registrados no histórico. Confira o histórico antes de repetir.`
        }
    }
    return 'Não foi possível concluir a ação agora. Confira o histórico de ticks e tente de novo.'
}

function completedTicksOf(err: unknown): number | undefined {
    if (err instanceof ApiError && typeof err.details === 'object' && err.details !== null) {
        const completed = (err.details as { completed_ticks?: unknown }).completed_ticks
        if (Array.isArray(completed)) return completed.length
    }
    return undefined
}

// Tela 10.5 (N.6) — seção "Tempo" do painel: estado do Temporizador, pausar e
// retomar a agenda, disparar um tick, avançar N dias e a linha do tempo de ticks.
// O mercado é compartilhado: disparar e avançar afetam todos os usuários, por
// isso passam por confirmação. A pausa só vale pro tick agendado.
export function AdminTempo() {
    const [page, setPage] = useState(1)
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const schedulerQuery = useSchedulerQuery()
    const ticksQuery = useTicksQuery(page)
    const setPaused = useSetSchedulerPausedMutation()
    const triggerTick = useTriggerTickMutation()
    const advanceTicks = useAdvanceTicksMutation()

    const busy = setPaused.isPending || triggerTick.isPending || advanceTicks.isPending || schedulerQuery.data?.tick_in_progress === true

    function resetFeedback() {
        setNotice(null)
        setError(null)
    }

    function togglePause() {
        if (!schedulerQuery.data) return
        resetFeedback()
        const nextPaused = !schedulerQuery.data.paused
        setPaused.mutate(nextPaused, {
            onSuccess: () =>
                setNotice(
                    nextPaused
                        ? 'Agenda pausada. Os ticks automáticos não rodam até você retomar.'
                        : 'Agenda retomada. O próximo tick agendado roda no próximo horário.',
                ),
            onError: (err) => setError(describeError(err)),
        })
    }

    function confirmPending() {
        if (!pending) return
        resetFeedback()
        if (pending.kind === 'tick') {
            triggerTick.mutate(undefined, {
                onSuccess: (result) => setNotice(`Tick executado: dia simulado ${result.day}.`),
                onError: (err) => setError(describeError(err)),
                onSettled: () => setPending(null),
            })
            return
        }
        advanceTicks.mutate(pending.days, {
            onSuccess: (result) => {
                const last = result.ticks.at(-1)
                setNotice(`${result.ticks.length} dia(s) avançado(s)${last ? `, até o dia simulado ${last.day}` : ''}.`)
            },
            onError: (err) => setError(describeError(err, completedTicksOf(err))),
            onSettled: () => setPending(null),
        })
    }

    const confirming = triggerTick.isPending || advanceTicks.isPending

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Tempo</h1>
            <p className={styles.subtitle}>Controle do Temporizador do mercado simulado e histórico de ticks.</p>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {schedulerQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível ler o estado do temporizador agora.
                </p>
            )}
            {schedulerQuery.isLoading && <p className={styles.loading}>Carregando estado…</p>}
            {schedulerQuery.data && (
                <SchedulerPanel
                    status={schedulerQuery.data}
                    busy={busy}
                    onTogglePause={togglePause}
                    onTriggerTick={() => setPending({ kind: 'tick' })}
                    onAdvance={(days) => setPending({ kind: 'advance', days })}
                />
            )}

            <h2 className={styles.sectionTitle}>Histórico de ticks</h2>
            {ticksQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o histórico agora. Tente novamente em instantes.
                </p>
            )}
            {ticksQuery.isLoading && <p className={styles.loading}>Carregando histórico…</p>}
            {ticksQuery.data && (
                <>
                    <p className={styles.total}>{ticksQuery.data.totalEntries} tick(s) registrado(s)</p>
                    <TickRunList ticks={ticksQuery.data.ticks} />
                    <Pagination
                        page={ticksQuery.data.page}
                        totalPages={ticksQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação do histórico de ticks"
                    />
                </>
            )}

            {pending?.kind === 'tick' && (
                <ConfirmDialog
                    title="Disparar 1 tick agora?"
                    confirmLabel="Disparar tick"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>Avança o mercado em 1 dia simulado. O mercado é único e compartilhado: isso afeta todos os usuários.</p>
                    <p>A ação fica registrada na auditoria e não pode ser desfeita.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'advance' && (
                <ConfirmDialog
                    title={`Avançar ${pending.days} dia(s) do mercado?`}
                    confirmLabel={`Avançar ${pending.days} dia(s)`}
                    pendingLabel="Avançando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Roda {pending.days} tick(s) em sequência. O mercado é único e compartilhado: isso afeta todos os usuários, com
                        ordens, preços e eventos correndo nesses dias.
                    </p>
                    <p>Pode levar alguns instantes. A ação fica registrada na auditoria e não pode ser desfeita.</p>
                </ConfirmDialog>
            )}
        </main>
    )
}
