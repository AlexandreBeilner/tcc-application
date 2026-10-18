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
import { useCreateDailyWordMutation, useDailyWordsQuery, useUpdateDailyWordMutation } from '../../../features/admin/useAdminDaily'
import type { ItemCommon } from '../../../features/admin/dailyAdmin'
import type { DailyChangeImpact, DailyPatch, DailyWord, DailyWordInput } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { AdminDailyItemFields } from '../../molecules/AdminDailyItemFields'
import { AdminDailySplit } from '../../molecules/AdminDailySplit'
import { AdminField, adminInputClass } from '../../molecules/AdminField'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

interface Draft {
    display: string
    definition: string
    common: ItemCommon
}

const EMPTY: Draft = { display: '', definition: '', common: EMPTY_COMMON }

function impactNotice(result: DailyChangeImpact, what: string): string {
    const parts = [`${what} salva.`]
    if (result.affected_puzzles.length > 0) {
        parts.push(
            `Aparece nos jogos ${formatNumbers(result.affected_puzzles)}. Desativar não tira do jogo já montado; troque o cartão se for o caso.`,
        )
    }
    if (result.cleared_reviews.length > 0) parts.push(`A revisão dos jogos ${formatNumbers(result.cleared_reviews)} foi zerada.`)
    return parts.join(' ')
}

// Palavras do dia (DI.5.1). A resposta é a identidade da palavra e não muda depois de criada: o texto
// mostrado pode ganhar acento ou caixa, a palavra é a mesma. A resposta precisa estar na lista aceita.
export function AdminDailyWords() {
    const wordsQuery = useDailyWordsQuery()
    const create = useCreateDailyWordMutation()
    const update = useUpdateDailyWordMutation()
    const [editing, setEditing] = useState<DailyWord | 'new' | null>(null)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [query, setQuery] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<{ id: string; patch: DailyPatch<DailyWordInput> } | null>(null)

    const words = (wordsQuery.data ?? [])
        .filter((w) => showInactive || w.active)
        .filter((w) => `${w.display} ${w.definition}`.toLowerCase().includes(query.toLowerCase()))

    function open(target: DailyWord | 'new') {
        setEditing(target)
        setNotice(null)
        setError(null)
        setDraft(target === 'new' ? EMPTY : { display: target.display, definition: target.definition, common: commonOf(target) })
    }

    function fail(err: unknown) {
        setNotice(null)
        const { message, problems } = describeDailyError(err)
        setError([message, ...problems.filter((p) => p !== message)].join('. '))
    }

    function save() {
        const fields = {
            display: draft.display.trim(),
            definition: draft.definition.trim(),
            category: draft.common.category,
            scope: draft.common.scope,
            learn_more: learnMoreOf(draft.common),
        }
        setError(null)
        if (editing === 'new') {
            create.mutate(fields, {
                onSuccess: () => {
                    setNotice('Palavra criada.')
                    setEditing(null)
                },
                onError: fail,
            })
        } else if (editing) {
            send(editing.id, fields, false)
        }
    }

    function send(id: string, patch: DailyPatch<DailyWordInput>, confirmed: boolean) {
        update.mutate(
            { id, patch: confirmed ? { ...patch, confirm_published: true } : patch },
            {
                onSuccess: (result) => {
                    setNotice(impactNotice(result, 'Palavra'))
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

    const form = editing && (
        <form
            className={styles.form}
            onSubmit={(event) => event.preventDefault()}
            aria-label={editing === 'new' ? 'Nova palavra' : 'Editar palavra'}
        >
            <h3 className={styles.formTitle}>{editing === 'new' ? 'Nova palavra' : `Editar ${editing.display}`}</h3>
            <AdminField label="Palavra" hint="Com acento, como aparece na revelação. De 4 a 9 letras, e precisa estar na lista aceita.">
                {(id) => (
                    <input
                        id={id}
                        className={adminInputClass}
                        value={draft.display}
                        maxLength={20}
                        onChange={(e) => setDraft({ ...draft, display: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField label="Definição" hint="Sem travessão. Aparece depois que o cartão termina.">
                {(id) => (
                    <textarea
                        id={id}
                        className={adminInputClass}
                        rows={3}
                        value={draft.definition}
                        maxLength={500}
                        onChange={(e) => setDraft({ ...draft, definition: e.target.value })}
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
                <Button
                    disabled={create.isPending || update.isPending || draft.display.trim() === '' || draft.definition.trim() === ''}
                    onClick={save}
                >
                    {create.isPending || update.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                </Button>
            </div>
        </form>
    )

    return (
        <section className={styles.root} aria-label="Palavras do dia">
            <div className={styles.toolbar}>
                <input
                    className={`${adminInputClass} ${styles.search}`}
                    value={query}
                    placeholder="Buscar palavra"
                    aria-label="Buscar palavra"
                    onChange={(e) => setQuery(e.target.value)}
                />
                <label className={styles.check}>
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Mostrar desativadas
                </label>
                <Button onClick={() => open('new')}>Nova palavra</Button>
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
                {wordsQuery.isLoading && <p className={styles.muted}>Carregando palavras…</p>}
                {wordsQuery.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar as palavras agora.
                    </p>
                )}
                <ul className={styles.items}>
                    {words.map((word) => (
                        <li key={word.id} className={styles.item}>
                            <div className={styles.itemMain}>
                                <span className={styles.name}>{word.display}</span>
                                <span className={styles.sub}>
                                    {categoryLabel(word.category)} · {DAILY_SCOPE_LABELS[word.scope]}
                                </span>
                                <span className={styles.text}>{word.definition}</span>
                            </div>
                            <div className={styles.itemSide}>
                                <span className={word.active ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                                    {word.active ? 'Ativa' : 'Desativada'}
                                </span>
                                <button type="button" className={styles.link} onClick={() => open(word)}>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className={styles.link}
                                    disabled={update.isPending}
                                    onClick={() => send(word.id, { active: !word.active }, false)}
                                >
                                    {word.active ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                {wordsQuery.data && words.length === 0 && <p className={styles.muted}>Nenhuma palavra encontrada.</p>}
            </AdminDailySplit>

            {confirm && (
                <ConfirmDialog
                    title="Palavra em jogo já publicado"
                    confirmLabel="Editar mesmo assim"
                    pendingLabel="Salvando…"
                    pending={update.isPending}
                    onConfirm={() => send(confirm.id, confirm.patch, true)}
                    onCancel={() => setConfirm(null)}
                >
                    <p>
                        Esta palavra está num jogo que já foi ao ar. Mudar o que o jogador vê depois do fim do cartão altera um jogo já
                        jogado.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}
