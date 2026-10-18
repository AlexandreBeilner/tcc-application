import { useState } from 'react'
import {
    categoryLabel,
    commonOf,
    EMPTY_COMMON,
    learnMoreOf,
    DAILY_SCOPE_LABELS,
    describeDailyError,
    formatNumbers,
    isConfirmationRequired,
} from '../../../features/admin/dailyAdmin'
import { useCreateDailyEventMutation, useDailyEventsQuery, useUpdateDailyEventMutation } from '../../../features/admin/useAdminDaily'
import type { ItemCommon } from '../../../features/admin/dailyAdmin'
import type { DailyChangeImpact, DailyEvent, DailyEventInput, DailyPatch } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { AdminDailyItemFields } from '../../molecules/AdminDailyItemFields'
import { AdminDailySplit } from '../../molecules/AdminDailySplit'
import { AdminField, adminInputClass } from '../../molecules/AdminField'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

interface Draft {
    year: string
    label: string
    explanation: string
    sourceRef: string
    common: ItemCommon
}

const EMPTY: Draft = { year: '', label: '', explanation: '', sourceRef: '', common: EMPTY_COMMON }

function impactNotice(result: DailyChangeImpact): string {
    const parts = ['Evento salvo.']
    if (result.affected_puzzles.length > 0) {
        parts.push(
            `Aparece nos jogos ${formatNumbers(result.affected_puzzles)}. Desativar não tira do jogo já montado; troque o cartão se for o caso.`,
        )
    }
    if (result.cleared_reviews.length > 0) parts.push(`A revisão dos jogos ${formatNumbers(result.cleared_reviews)} foi zerada.`)
    return parts.join(' ')
}

// Eventos da Linha do tempo (DI.5.1). O nome curto aparece antes de o jogador ordenar, então não pode
// conter o ano. Fonte primária obrigatória, e o ano é conferido na fonte, nunca de memória.
export function AdminDailyEvents() {
    const query = useDailyEventsQuery()
    const create = useCreateDailyEventMutation()
    const update = useUpdateDailyEventMutation()
    const [editing, setEditing] = useState<DailyEvent | 'new' | null>(null)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [search, setSearch] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<{ id: string; patch: DailyPatch<DailyEventInput> } | null>(null)

    const events = (query.data ?? [])
        .filter((e) => showInactive || e.active)
        .filter((e) => `${e.label} ${e.year}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.year - b.year)

    function open(target: DailyEvent | 'new') {
        setEditing(target)
        setNotice(null)
        setError(null)
        setDraft(
            target === 'new'
                ? EMPTY
                : {
                      year: String(target.year),
                      label: target.label,
                      explanation: target.explanation,
                      sourceRef: target.source_ref,
                      common: commonOf(target),
                  },
        )
    }

    function fail(err: unknown) {
        setNotice(null)
        const { message, problems } = describeDailyError(err)
        setError([message, ...problems.filter((p) => p !== message)].join('. '))
    }

    function send(id: string, patch: DailyPatch<DailyEventInput>, confirmed: boolean) {
        update.mutate(
            { id, patch: confirmed ? { ...patch, confirm_published: true } : patch },
            {
                onSuccess: (result) => {
                    setNotice(impactNotice(result))
                    setEditing(null)
                    setConfirm(null)
                },
                onError: (err) => {
                    if (isConfirmationRequired(err)) return setConfirm({ id, patch })
                    setConfirm(null)
                    fail(err)
                },
            },
        )
    }

    function save() {
        const fields = {
            year: Number(draft.year),
            label: draft.label.trim(),
            explanation: draft.explanation.trim(),
            source_ref: draft.sourceRef.trim(),
            category: draft.common.category,
            scope: draft.common.scope,
            learn_more: learnMoreOf(draft.common),
        }
        setError(null)
        if (editing === 'new') {
            create.mutate(fields, {
                onSuccess: () => {
                    setNotice('Evento criado. Ele entra na agenda sem revisão.')
                    setEditing(null)
                },
                onError: fail,
            })
        } else if (editing) {
            send(editing.id, fields, false)
        }
    }

    const canSave =
        Number.isInteger(Number(draft.year)) &&
        draft.year.trim() !== '' &&
        draft.label.trim() !== '' &&
        draft.explanation.trim() !== '' &&
        draft.sourceRef.trim() !== ''

    const form = editing && (
        <form
            className={styles.form}
            onSubmit={(event) => event.preventDefault()}
            aria-label={editing === 'new' ? 'Novo evento' : 'Editar evento'}
        >
            <h3 className={styles.formTitle}>{editing === 'new' ? 'Novo evento' : 'Editar evento'}</h3>
            <AdminField label="Ano" hint="De 1500 a 2200. Só o ano ordena a Linha do tempo.">
                {(id) => (
                    <input
                        id={id}
                        className={adminInputClass}
                        inputMode="numeric"
                        value={draft.year}
                        onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField label="Nome curto" hint="Aparece antes de ordenar. Não pode conter o ano, nem entregar a posição.">
                {(id) => (
                    <input
                        id={id}
                        className={adminInputClass}
                        value={draft.label}
                        maxLength={80}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField
                label="Por que importou"
                hint={`${draft.explanation.length} de 280 caracteres. Fato de fora precisa ligar ao efeito no Brasil.`}
            >
                {(id) => (
                    <textarea
                        id={id}
                        className={adminInputClass}
                        rows={3}
                        value={draft.explanation}
                        maxLength={400}
                        onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField label="Fonte primária" hint="Data conferida na fonte, não em memória nem em site de terceiro. Obrigatória.">
                {(id) => (
                    <textarea
                        id={id}
                        className={adminInputClass}
                        rows={2}
                        value={draft.sourceRef}
                        maxLength={600}
                        onChange={(e) => setDraft({ ...draft, sourceRef: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminDailyItemFields value={draft.common} onChange={(common) => setDraft({ ...draft, common })} />
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <div className={styles.actions}>
                <Button disabled={create.isPending || update.isPending || !canSave} onClick={save}>
                    {create.isPending || update.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                </Button>
            </div>
        </form>
    )

    return (
        <section className={styles.root} aria-label="Eventos da Linha do tempo">
            <div className={styles.toolbar}>
                <input
                    className={`${adminInputClass} ${styles.search}`}
                    value={search}
                    placeholder="Buscar evento ou ano"
                    aria-label="Buscar evento"
                    onChange={(e) => setSearch(e.target.value)}
                />
                <label className={styles.check}>
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Mostrar desativados
                </label>
                <Button onClick={() => open('new')}>Novo evento</Button>
            </div>
            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {!editing && error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <AdminDailySplit form={form || null}>
                {query.isLoading && <p className={styles.muted}>Carregando eventos…</p>}
                {query.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar os eventos agora.
                    </p>
                )}
                <ul className={styles.items}>
                    {events.map((e) => (
                        <li key={e.id} className={styles.item}>
                            <div className={styles.itemMain}>
                                <span className={styles.name}>
                                    {e.year} · {e.label}
                                </span>
                                <span className={styles.sub}>
                                    {categoryLabel(e.category)} · {DAILY_SCOPE_LABELS[e.scope]}
                                </span>
                                <span className={styles.text}>Fonte: {e.source_ref}</span>
                            </div>
                            <div className={styles.itemSide}>
                                <span className={e.reviewed_at ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                                    {e.reviewed_at ? 'Revisado' : 'Sem revisão'}
                                </span>
                                {!e.active && <span className={`${styles.badge} ${styles.dashed}`}>Desativado</span>}
                                <button type="button" className={styles.link} onClick={() => open(e)}>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className={styles.link}
                                    disabled={update.isPending}
                                    onClick={() => send(e.id, { active: !e.active }, false)}
                                >
                                    {e.active ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                {query.data && events.length === 0 && <p className={styles.muted}>Nenhum evento encontrado.</p>}
            </AdminDailySplit>

            {confirm && (
                <ConfirmDialog
                    title="Evento em jogo já publicado"
                    confirmLabel="Editar mesmo assim"
                    pendingLabel="Salvando…"
                    pending={update.isPending}
                    onConfirm={() => send(confirm.id, confirm.patch, true)}
                    onCancel={() => setConfirm(null)}
                >
                    <p>
                        Este evento está numa Linha do tempo que já foi ao ar. Mudar o ano ou o texto altera um jogo que as pessoas já
                        jogaram.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}
