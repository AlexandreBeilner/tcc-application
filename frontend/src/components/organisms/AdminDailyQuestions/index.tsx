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
import {
    useCreateDailyQuestionMutation,
    useDailyQuestionsQuery,
    useUpdateDailyQuestionMutation,
} from '../../../features/admin/useAdminDaily'
import type { ItemCommon } from '../../../features/admin/dailyAdmin'
import type { DailyChangeImpact, DailyPatch, DailyQuestion, DailyQuestionInput } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { AdminDailyItemFields } from '../../molecules/AdminDailyItemFields'
import { AdminDailySplit } from '../../molecules/AdminDailySplit'
import { AdminField, adminInputClass } from '../../molecules/AdminField'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

interface Draft {
    question: string
    // Uma alternativa por linha.
    options: string
    correctIndex: number
    explanation: string
    sourceRef: string
    common: ItemCommon
}

const EMPTY: Draft = { question: '', options: '', correctIndex: 0, explanation: '', sourceRef: '', common: EMPTY_COMMON }

function impactNotice(result: DailyChangeImpact): string {
    const parts = ['Pergunta salva.']
    if (result.affected_puzzles.length > 0) {
        parts.push(
            `Aparece nos jogos ${formatNumbers(result.affected_puzzles)}. Desativar não tira do jogo já montado; troque o cartão se for o caso.`,
        )
    }
    if (result.cleared_reviews.length > 0) parts.push(`A revisão dos jogos ${formatNumbers(result.cleared_reviews)} foi zerada.`)
    return parts.join(' ')
}

function optionsOf(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
}

// Perguntas do dia (DI.5.1): conhecimentos gerais de economia e finanças, múltipla escolha. A fonte
// primária é obrigatória e a explicação tem até 280 caracteres (checklist da seção 3.3).
export function AdminDailyQuestions() {
    const query = useDailyQuestionsQuery()
    const create = useCreateDailyQuestionMutation()
    const update = useUpdateDailyQuestionMutation()
    const [editing, setEditing] = useState<DailyQuestion | 'new' | null>(null)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [search, setSearch] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<{ id: string; patch: DailyPatch<DailyQuestionInput> } | null>(null)

    const questions = (query.data ?? [])
        .filter((q) => showInactive || q.active)
        .filter((q) => q.question.toLowerCase().includes(search.toLowerCase()))
    const options = optionsOf(draft.options)

    function open(target: DailyQuestion | 'new') {
        setEditing(target)
        setNotice(null)
        setError(null)
        setDraft(
            target === 'new'
                ? EMPTY
                : {
                      question: target.question,
                      options: target.options.join('\n'),
                      correctIndex: target.correct_index,
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

    function send(id: string, patch: DailyPatch<DailyQuestionInput>, confirmed: boolean) {
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
            question: draft.question.trim(),
            options,
            correct_index: draft.correctIndex,
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
                    setNotice('Pergunta criada. Ela entra na agenda sem revisão.')
                    setEditing(null)
                },
                onError: fail,
            })
        } else if (editing) {
            send(editing.id, fields, false)
        }
    }

    const canSave =
        draft.question.trim() !== '' &&
        draft.explanation.trim() !== '' &&
        draft.sourceRef.trim() !== '' &&
        options.length >= 2 &&
        draft.correctIndex < options.length

    const form = editing && (
        <form
            className={styles.form}
            onSubmit={(event) => event.preventDefault()}
            aria-label={editing === 'new' ? 'Nova pergunta' : 'Editar pergunta'}
        >
            <h3 className={styles.formTitle}>{editing === 'new' ? 'Nova pergunta' : 'Editar pergunta'}</h3>
            <AdminField label="Pergunta" hint="Sem travessão, e o enunciado não pode entregar a resposta.">
                {(id) => (
                    <textarea
                        id={id}
                        className={adminInputClass}
                        rows={2}
                        value={draft.question}
                        maxLength={400}
                        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField label="Alternativas" hint="Uma por linha, de 2 a 6. As erradas precisam ser plausíveis.">
                {(id) => (
                    <textarea
                        id={id}
                        className={adminInputClass}
                        rows={4}
                        value={draft.options}
                        onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                    />
                )}
            </AdminField>
            <AdminField label="Alternativa correta">
                {(id) => (
                    <select
                        id={id}
                        className={adminInputClass}
                        value={draft.correctIndex}
                        onChange={(e) => setDraft({ ...draft, correctIndex: Number(e.target.value) })}
                    >
                        {options.map((option, index) => (
                            <option key={`${index}-${option}`} value={index}>
                                {index + 1}. {option}
                            </option>
                        ))}
                    </select>
                )}
            </AdminField>
            <AdminField label="Explicação" hint={`${draft.explanation.length} de 280 caracteres. Aparece depois da resposta.`}>
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
            <AdminField label="Fonte primária" hint="Banco Central, CVM, B3, Tesouro, IBGE, legislação ou documento da época. Obrigatória.">
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
        <section className={styles.root} aria-label="Perguntas do dia">
            <div className={styles.toolbar}>
                <input
                    className={`${adminInputClass} ${styles.search}`}
                    value={search}
                    placeholder="Buscar pergunta"
                    aria-label="Buscar pergunta"
                    onChange={(e) => setSearch(e.target.value)}
                />
                <label className={styles.check}>
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Mostrar desativadas
                </label>
                <Button onClick={() => open('new')}>Nova pergunta</Button>
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
                {query.isLoading && <p className={styles.muted}>Carregando perguntas…</p>}
                {query.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar as perguntas agora.
                    </p>
                )}
                <ul className={styles.items}>
                    {questions.map((q) => (
                        <li key={q.id} className={styles.item}>
                            <div className={styles.itemMain}>
                                <span className={styles.name}>{q.question}</span>
                                <span className={styles.sub}>
                                    {categoryLabel(q.category)} · {DAILY_SCOPE_LABELS[q.scope]}
                                </span>
                                <span className={styles.text}>Fonte: {q.source_ref}</span>
                            </div>
                            <div className={styles.itemSide}>
                                <span className={q.reviewed_at ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                                    {q.reviewed_at ? 'Revisada' : 'Sem revisão'}
                                </span>
                                {!q.active && <span className={`${styles.badge} ${styles.dashed}`}>Desativada</span>}
                                <button type="button" className={styles.link} onClick={() => open(q)}>
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className={styles.link}
                                    disabled={update.isPending}
                                    onClick={() => send(q.id, { active: !q.active }, false)}
                                >
                                    {q.active ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                {query.data && questions.length === 0 && <p className={styles.muted}>Nenhuma pergunta encontrada.</p>}
            </AdminDailySplit>

            {confirm && (
                <ConfirmDialog
                    title="Pergunta em jogo já publicado"
                    confirmLabel="Editar mesmo assim"
                    pendingLabel="Salvando…"
                    pending={update.isPending}
                    onConfirm={() => send(confirm.id, confirm.patch, true)}
                    onCancel={() => setConfirm(null)}
                >
                    <p>
                        Esta pergunta está num jogo que já foi ao ar. Mudar texto, alternativas ou gabarito altera um jogo que as pessoas já
                        jogaram.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}
