import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { formatDateTime } from '../../../features/admin/timeFormat'
import type { SchedulerPanelProps } from './types'
import styles from './index.module.css'

export type { SchedulerPanelProps } from './types'

// Mesmo teto do backend/motor (`tick.MaxAdvanceDays`).
const MAX_ADVANCE_DAYS = 30

function stateOf(status: SchedulerPanelProps['status']): { label: string; className: string } {
    if (!status.enabled) return { label: 'Desligada neste ambiente', className: 'off' }
    if (status.paused) return { label: 'Pausada', className: 'paused' }
    return { label: 'Ativa', className: 'active' }
}

// Estado do Temporizador e as quatro ações do painel de Tempo (N.6). Só
// apresenta e repassa: a confirmação e as mutations ficam na tela. Pausa e
// retomada só valem pro tick agendado; "Disparar 1 tick" e "Avançar" são
// manuais e funcionam também com a agenda pausada.
export function SchedulerPanel({ status, busy, onTogglePause, onTriggerTick, onAdvance }: SchedulerPanelProps) {
    const [daysInput, setDaysInput] = useState('5')
    const days = Number(daysInput)
    const validDays = Number.isInteger(days) && days >= 1 && days <= MAX_ADVANCE_DAYS
    const state = stateOf(status)

    return (
        <section className={styles.panel} aria-label="Estado do temporizador">
            <div className={styles.head}>
                <span className={`${styles.badge} ${styles[state.className]}`}>{state.label}</span>
                {status.tick_in_progress && <span className={styles.running}>Tick em andamento</span>}
            </div>

            {!status.enabled && (
                <p className={styles.notice}>
                    A agenda automática está desligada neste ambiente (TICK_SCHEDULER_ENABLED=false). A pausa não se aplica; os ticks só
                    rodam por ação manual.
                </p>
            )}

            <dl className={styles.facts}>
                <div>
                    <dt>Próximo tick agendado</dt>
                    <dd>{status.paused ? 'Pausado' : formatDateTime(status.next_slot_at)}</dd>
                </div>
                <div>
                    <dt>Último tick</dt>
                    <dd>{formatDateTime(status.last_tick_at)}</dd>
                </div>
                <div>
                    <dt>Ritmo</dt>
                    <dd>
                        {status.ticks_per_day} ticks por dia real ({status.timezone})
                    </dd>
                </div>
                <div>
                    <dt>Recuperação máxima</dt>
                    <dd>{status.max_catch_up} ticks atrasados</dd>
                </div>
                {status.resumed_at && (
                    <div>
                        <dt>Retomada em</dt>
                        <dd>{formatDateTime(status.resumed_at)}</dd>
                    </div>
                )}
            </dl>

            <div className={styles.actions}>
                <Button variant="secondary" onClick={onTogglePause} disabled={busy || !status.enabled}>
                    {status.paused ? 'Retomar agenda' : 'Pausar agenda'}
                </Button>
                <Button onClick={onTriggerTick} disabled={busy}>
                    Disparar 1 tick
                </Button>
            </div>

            <div className={styles.advance}>
                <label className={styles.advanceField}>
                    <span>Avançar dias do mercado</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_ADVANCE_DAYS}
                        className={styles.daysInput}
                        value={daysInput}
                        onChange={(event) => setDaysInput(event.target.value)}
                    />
                </label>
                <Button onClick={() => onAdvance(days)} disabled={busy || !validDays}>
                    Avançar
                </Button>
                {!validDays && <span className={styles.hint}>Informe de 1 a {MAX_ADVANCE_DAYS} dias.</span>}
            </div>
        </section>
    )
}
