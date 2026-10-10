import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import { BODY_MAX_LENGTH, hasMarkup, localInputToIso, TITLE_MAX_LENGTH } from '../../../features/admin/announcementForm'
import { PAUSE_ALL_CONFIRMATION } from '../../../features/admin/tradingHalts'
import { formatDateTime } from '../../../features/admin/timeFormat'
import type { AdminMaintenancePanelProps, MaintenanceFormValues } from './types'
import styles from './index.module.css'

export type { AdminMaintenancePanelProps, MaintenanceFormValues } from './types'

const EMPTY: MaintenanceFormValues = { title: '', body: '', endsAt: '', pauseTrading: false, notifyByEmail: false }

function problemOf(values: MaintenanceFormValues): string | null {
    const title = values.title.trim()
    const body = values.body.trim()
    if (title.length === 0 || title.length > TITLE_MAX_LENGTH) return `O título precisa ter de 1 a ${TITLE_MAX_LENGTH} caracteres.`
    if (body.length === 0 || body.length > BODY_MAX_LENGTH) return `O texto precisa ter de 1 a ${BODY_MAX_LENGTH} caracteres.`
    if (hasMarkup(title) || hasMarkup(body)) return 'O texto é simples: não use os sinais < e >.'
    const ends = localInputToIso(values.endsAt)
    if (ends && new Date(ends).getTime() <= Date.now()) return 'O fim precisa estar no futuro.'
    return null
}

// Modo de manutenção (N.20): liga um aviso crítico e não dispensável e, se pedido, a pausa global
// de negociação (N.9). Com a pausa ligada a ação pede confirmação digitada e senha recente.
export function AdminMaintenancePanel({ open, busy, onStart, onEnd }: AdminMaintenancePanelProps) {
    const [values, setValues] = useState<MaintenanceFormValues>(EMPTY)
    const [touched, setTouched] = useState(false)
    const [confirming, setConfirming] = useState(false)

    if (open) {
        return (
            <section className={styles.panel} aria-label="Manutenção em andamento">
                <h2 className={styles.title}>Manutenção {open.status === 'scheduled' ? 'agendada' : 'em andamento'}</h2>
                <p className={styles.text}>
                    {open.title}. {open.body}
                </p>
                <p className={styles.meta}>
                    Desde {formatDateTime(open.starts_at)}
                    {open.ends_at ? `, prevista até ${formatDateTime(open.ends_at)}` : ', sem fim definido'}
                </p>
                {open.linked_halt_id && (
                    <p className={styles.meta}>A negociação de todo o mercado está pausada. Encerrar a manutenção retoma a negociação.</p>
                )}
                <div>
                    <Button disabled={busy} onClick={() => onEnd(open)}>
                        Encerrar manutenção
                    </Button>
                </div>
            </section>
        )
    }

    const problem = problemOf(values)
    const set = <K extends keyof MaintenanceFormValues>(key: K, value: MaintenanceFormValues[K]) =>
        setValues((current) => ({ ...current, [key]: value }))

    function submit() {
        setTouched(true)
        if (problem) return
        if (values.pauseTrading) {
            setConfirming(true)
            return
        }
        start()
    }

    function start() {
        onStart(values)
        setConfirming(false)
        setValues(EMPTY)
        setTouched(false)
    }

    return (
        <section className={styles.panel} aria-label="Modo de manutenção">
            <h2 className={styles.title}>Modo de manutenção</h2>
            <p className={styles.text}>
                Abre uma faixa crítica, que o usuário não consegue dispensar, até você encerrar a manutenção. Opcionalmente, pausa a
                negociação de todo o mercado enquanto ela durar.
            </p>
            <label className={styles.field}>
                <span>Título (até {TITLE_MAX_LENGTH} caracteres)</span>
                <input
                    className={styles.input}
                    value={values.title}
                    maxLength={TITLE_MAX_LENGTH}
                    placeholder="Ex: Manutenção às 22h"
                    onChange={(event) => set('title', event.target.value)}
                />
            </label>
            <label className={styles.field}>
                <span>
                    Texto ({values.body.length}/{BODY_MAX_LENGTH})
                </span>
                <textarea
                    className={styles.input}
                    value={values.body}
                    maxLength={BODY_MAX_LENGTH}
                    rows={2}
                    placeholder="Ex: A plataforma volta em cerca de uma hora."
                    onChange={(event) => set('body', event.target.value)}
                />
            </label>
            <label className={styles.field}>
                <span>Fim previsto (opcional)</span>
                <input
                    className={styles.input}
                    type="datetime-local"
                    value={values.endsAt}
                    onChange={(event) => set('endsAt', event.target.value)}
                />
            </label>
            <label className={styles.check}>
                <input type="checkbox" checked={values.pauseTrading} onChange={(event) => set('pauseTrading', event.target.checked)} />
                <span>Pausar a negociação de todo o mercado enquanto durar</span>
            </label>
            <label className={styles.check}>
                <input type="checkbox" checked={values.notifyByEmail} onChange={(event) => set('notifyByEmail', event.target.checked)} />
                <span>Avisar também por e-mail quem tem o e-mail confirmado</span>
            </label>
            {touched && problem && (
                <p className={styles.error} role="alert">
                    {problem}
                </p>
            )}
            <div>
                <Button disabled={busy} onClick={submit}>
                    Iniciar manutenção
                </Button>
            </div>

            {confirming && (
                <ConfirmDialog
                    title="Iniciar a manutenção e pausar o mercado?"
                    confirmLabel="Iniciar manutenção"
                    pendingLabel="Iniciando…"
                    pending={busy}
                    requireText={PAUSE_ALL_CONFIRMATION}
                    onConfirm={start}
                    onCancel={() => setConfirming(false)}
                >
                    <p>
                        Ordens novas de usuários e de bots passam a ser recusadas em todos os ativos e todos os usuários veem a faixa
                        crítica. O tick segue.
                    </p>
                    <p>Encerrar a manutenção retoma a negociação. A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
