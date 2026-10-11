import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import {
    blankDraft,
    blankEffect,
    blankOption,
    DIRECTION_OPTIONS,
    describeAssemblyError,
    draftToContent,
    METRIC_OPTIONS,
    OPTION_EFFECTS_MAX,
    OPTION_EFFECTS_MIN,
    POLICY_METRIC,
    POLICY_OPTIONS,
    PURPOSE_OPTIONS,
    suggestKey,
    TEMPLATE_OPTIONS_MAX,
    TEMPLATE_OPTIONS_MIN,
    toDraft,
} from '../../features/admin/assemblies'
import type { EffectDraft, OptionDraft, TemplateDraft } from '../../features/admin/assemblies'
import { MACRO_EVENT_SECTORS } from '../../features/admin/targetOptions'
import {
    useAgendaTemplatesQuery,
    useCreateAgendaTemplateMutation,
    useSetAgendaTemplateActiveMutation,
    useUpdateAgendaTemplateMutation,
} from '../../features/admin/useAgendaTemplates'
import type { AgendaTemplate } from '../../services/admin'
import styles from './index.module.css'

const SECTOR_OPTIONS = [{ value: '', label: 'Qualquer setor' }, ...MACRO_EVENT_SECTORS.map((sector) => ({ value: sector, label: sector }))]

// Tela do catálogo de pautas (MO.6.8): criar, editar e ativar ou desativar pautas das assembleias.
// Nunca se apaga: propostas e assembleias referenciam a chave. A edição vale para as próximas
// assembleias e para as propostas na fila; as assembleias já abertas guardam a própria cópia.
export function AdminAssembleiaPautas() {
    const [draft, setDraft] = useState<TemplateDraft>(blankDraft)
    // Chave da pauta em edição; `null` = pauta nova.
    const [editing, setEditing] = useState<string | null>(null)
    const [keyTouched, setKeyTouched] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toggling, setToggling] = useState<AgendaTemplate | null>(null)

    const query = useAgendaTemplatesQuery()
    const create = useCreateAgendaTemplateMutation()
    const update = useUpdateAgendaTemplateMutation()
    const setActive = useSetAgendaTemplateActiveMutation()
    const busy = create.isPending || update.isPending || setActive.isPending

    const editingTemplate = (query.data ?? []).find((t) => t.key === editing)

    function startNew() {
        setEditing(null)
        setDraft(blankDraft())
        setKeyTouched(false)
        setFormError(null)
    }

    function startEdit(template: AgendaTemplate) {
        setEditing(template.key)
        setDraft(toDraft(template))
        setKeyTouched(true)
        setFormError(null)
        setNotice(null)
        setError(null)
    }

    function patch(next: Partial<TemplateDraft>) {
        setDraft((prev) => ({ ...prev, ...next }))
    }

    function patchOption(index: number, next: Partial<OptionDraft>) {
        setDraft((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === index ? { ...o, ...next } : o)) }))
    }

    function patchEffect(optionIndex: number, effectIndex: number, next: Partial<EffectDraft>) {
        setDraft((prev) => ({
            ...prev,
            options: prev.options.map((o, i) =>
                i === optionIndex ? { ...o, effects: o.effects.map((e, j) => (j === effectIndex ? { ...e, ...next } : e)) } : o,
            ),
        }))
    }

    // A segunda alavanca nasce numa métrica que a opção ainda não usa (o catálogo não aceita repetir).
    function addEffect(optionIndex: number) {
        setDraft((prev) => ({
            ...prev,
            options: prev.options.map((o, i) => {
                if (i !== optionIndex) return o
                const used = new Set(o.effects.map((e) => e.metric))
                const metric = METRIC_OPTIONS.find((m) => !used.has(m.value))?.value ?? blankEffect().metric
                return { ...o, effects: [...o.effects, { ...blankEffect(), metric }] }
            }),
        }))
    }

    function removeEffect(optionIndex: number, effectIndex: number) {
        setDraft((prev) => ({
            ...prev,
            options: prev.options.map((o, i) => (i === optionIndex ? { ...o, effects: o.effects.filter((_, j) => j !== effectIndex) } : o)),
        }))
    }

    function save() {
        setNotice(null)
        setError(null)
        const built = draftToContent(draft)
        if ('error' in built) {
            setFormError(built.error)
            return
        }
        setFormError(null)
        const onError = (err: unknown) => setError(describeAssemblyError(err))
        if (editing) {
            update.mutate(
                { key: editing, content: built.content },
                { onSuccess: () => setNotice(`Pauta ${editing} salva. Vale para as próximas assembleias.`), onError },
            )
            return
        }
        const key = draft.key.trim()
        create.mutate(
            { key, content: built.content },
            {
                onSuccess: () => {
                    setNotice(`Pauta ${key} criada e ativa.`)
                    startNew()
                },
                onError,
            },
        )
    }

    function confirmToggle() {
        if (!toggling) return
        setNotice(null)
        setError(null)
        const next = !toggling.active
        setActive.mutate(
            { key: toggling.key, active: next },
            {
                onSuccess: () => setNotice(next ? `Pauta ${toggling.key} ativada.` : `Pauta ${toggling.key} desativada.`),
                onError: (err) => setError(describeAssemblyError(err)),
                onSettled: () => setToggling(null),
            },
        )
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Catálogo de pautas</h1>
                    <p className={styles.subtitle}>
                        Cada pauta tem de dois a quatro lados, com ganho e perda, e cada lado mexe em uma ou duas alavancas da empresa:
                        crescimento, qualidade, payout, prêmio da ação PN ou política de dividendo. A pauta de destinação do lucro só abre
                        quando o dividendo do balanço está retido. A edição vale para as próximas assembleias e para as propostas na fila;
                        as assembleias abertas guardam a própria cópia. Pauta não se apaga: desative.
                    </p>
                </div>
                <Link to="/admin/assembleias" className={styles.link}>
                    Voltar às assembleias
                </Link>
            </header>

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

            <div className={styles.layout}>
                <section className={styles.section} aria-label="Pautas">
                    <h2 className={styles.sectionTitle}>Pautas</h2>
                    {query.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar as pautas agora. Tente novamente em instantes.
                        </p>
                    )}
                    {query.isLoading && <p className={styles.loading}>Carregando pautas…</p>}
                    <ul className={styles.list}>
                        {(query.data ?? []).map((template) => (
                            <li key={template.key} className={`${styles.item} ${template.key === editing ? styles.selected : ''}`}>
                                <div className={styles.itemHead}>
                                    <span className={`${styles.badge} ${template.active ? '' : styles.dashed}`}>
                                        {template.active ? 'Ativa' : 'Inativa'}
                                    </span>
                                    <span className={styles.itemTitle}>{template.title}</span>
                                    <div className={styles.itemActions}>
                                        <button type="button" className={styles.small} onClick={() => startEdit(template)}>
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.small}
                                            disabled={busy}
                                            onClick={() => setToggling(template)}
                                        >
                                            {template.active ? 'Desativar' : 'Ativar'}
                                        </button>
                                    </div>
                                </div>
                                <p className={styles.meta}>
                                    {template.key} · {template.purpose === 'profit' ? 'Destinação do lucro' : 'Geral'} ·{' '}
                                    {template.sector ?? 'Qualquer setor'} · {template.options.length} opções · em{' '}
                                    {template.usage.assemblies} assembleias e {template.usage.active_proposals} propostas ativas
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className={`${styles.panel} ${styles.editor}`} aria-label={editing ? 'Editar pauta' : 'Nova pauta'}>
                    <h2 className={styles.sectionTitle}>{editing ? `Editar ${editing}` : 'Nova pauta'}</h2>
                    {editingTemplate && (editingTemplate.usage.assemblies > 0 || editingTemplate.usage.active_proposals > 0) && (
                        <p className={styles.hint}>
                            Esta pauta já foi usada em {editingTemplate.usage.assemblies} assembleias e está em{' '}
                            {editingTemplate.usage.active_proposals} propostas ativas. As assembleias existentes não mudam; as propostas na
                            fila passam a mostrar o texto novo.
                        </p>
                    )}
                    <label className={styles.field}>
                        <span>Título</span>
                        <input
                            className={styles.input}
                            value={draft.title}
                            onChange={(event) => {
                                const title = event.target.value
                                patch(!editing && !keyTouched ? { title, key: suggestKey(title) } : { title })
                            }}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Chave (definitiva: minúsculas, números e _)</span>
                        <input
                            className={styles.input}
                            value={draft.key}
                            disabled={editing !== null}
                            onChange={(event) => {
                                setKeyTouched(true)
                                patch({ key: event.target.value })
                            }}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Finalidade</span>
                        <Select
                            aria-label="Finalidade da pauta"
                            value={draft.purpose}
                            options={PURPOSE_OPTIONS}
                            onChange={(purpose) => patch({ purpose: purpose === 'profit' ? 'profit' : 'general' })}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Setor</span>
                        <Select
                            aria-label="Setor da pauta"
                            value={draft.sector}
                            options={SECTOR_OPTIONS}
                            onChange={(sector) => patch({ sector })}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Descrição</span>
                        <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            value={draft.description}
                            onChange={(event) => patch({ description: event.target.value })}
                        />
                    </label>

                    {draft.options.map((option, index) => (
                        <fieldset key={index} className={styles.optionBox}>
                            <legend className={styles.optionTitle}>Opção {index + 1}</legend>
                            <label className={styles.field}>
                                <span>Chave da opção</span>
                                <input
                                    className={styles.input}
                                    value={option.key}
                                    onChange={(event) => patchOption(index, { key: event.target.value })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Rótulo</span>
                                <input
                                    className={styles.input}
                                    value={option.label}
                                    onChange={(event) => patchOption(index, { label: event.target.value })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>O que ganha</span>
                                <input
                                    className={styles.input}
                                    value={option.gain}
                                    onChange={(event) => patchOption(index, { gain: event.target.value })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>O que perde</span>
                                <input
                                    className={styles.input}
                                    value={option.loss}
                                    onChange={(event) => patchOption(index, { loss: event.target.value })}
                                />
                            </label>
                            {option.effects.map((effect, effectIndex) => {
                                const label = `${index + 1}${option.effects.length > 1 ? `, efeito ${effectIndex + 1}` : ''}`
                                return (
                                    <div key={effectIndex} className={styles.inline}>
                                        <label className={styles.field}>
                                            <span>Mexe em</span>
                                            <Select
                                                aria-label={`Alavanca da opção ${label}`}
                                                value={effect.metric}
                                                options={METRIC_OPTIONS}
                                                onChange={(metric) => patchEffect(index, effectIndex, { metric })}
                                            />
                                        </label>
                                        {effect.metric === POLICY_METRIC ? (
                                            <label className={styles.field}>
                                                <span>Passa a pagar</span>
                                                <Select
                                                    aria-label={`Política da opção ${label}`}
                                                    value={effect.value}
                                                    options={POLICY_OPTIONS}
                                                    onChange={(value) => patchEffect(index, effectIndex, { value })}
                                                />
                                            </label>
                                        ) : (
                                            <>
                                                <label className={styles.field}>
                                                    <span>Sentido</span>
                                                    <Select
                                                        aria-label={`Sentido da opção ${label}`}
                                                        value={effect.direction}
                                                        options={DIRECTION_OPTIONS}
                                                        onChange={(direction) =>
                                                            patchEffect(index, effectIndex, { direction: direction === '-1' ? '-1' : '1' })
                                                        }
                                                    />
                                                </label>
                                                <label className={styles.field}>
                                                    <span>Intensidade (0 a 1)</span>
                                                    <input
                                                        className={styles.input}
                                                        aria-label={`Intensidade da opção ${label}`}
                                                        inputMode="decimal"
                                                        value={effect.intensity}
                                                        onChange={(event) =>
                                                            patchEffect(index, effectIndex, { intensity: event.target.value })
                                                        }
                                                    />
                                                </label>
                                            </>
                                        )}
                                        {option.effects.length > OPTION_EFFECTS_MIN && (
                                            <button type="button" className={styles.small} onClick={() => removeEffect(index, effectIndex)}>
                                                Remover efeito {effectIndex + 1}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                            {option.effects.length < OPTION_EFFECTS_MAX && (
                                <button type="button" className={styles.small} onClick={() => addEffect(index)}>
                                    Adicionar segundo efeito
                                </button>
                            )}
                            {draft.options.length > TEMPLATE_OPTIONS_MIN && (
                                <button
                                    type="button"
                                    className={styles.small}
                                    onClick={() => patch({ options: draft.options.filter((_, i) => i !== index) })}
                                >
                                    Remover opção {index + 1}
                                </button>
                            )}
                        </fieldset>
                    ))}
                    {draft.options.length < TEMPLATE_OPTIONS_MAX && (
                        <button
                            type="button"
                            className={styles.small}
                            onClick={() => patch({ options: [...draft.options, blankOption()] })}
                        >
                            Adicionar opção
                        </button>
                    )}
                    <p className={styles.hint}>
                        A intensidade é a fração da faixa do motor que a opção usa: 1 usa a faixa inteira. Uma opção mexe em no máximo duas
                        alavancas, sempre diferentes, e a ficha do app as mostra no mesmo peso, sem recomendar lado. O texto aparece no app,
                        então não use travessão.
                    </p>

                    {formError && (
                        <p className={styles.fieldError} role="alert">
                            {formError}
                        </p>
                    )}
                    <div className={styles.actions}>
                        <Button disabled={busy} onClick={save}>
                            {editing ? 'Salvar alterações' : 'Criar pauta'}
                        </Button>
                        {editing && (
                            <Button variant="secondary" disabled={busy} onClick={startNew}>
                                Nova pauta
                            </Button>
                        )}
                    </div>
                </section>
            </div>

            {toggling && (
                <ConfirmDialog
                    title={toggling.active ? `Desativar ${toggling.title}?` : `Ativar ${toggling.title}?`}
                    confirmLabel={toggling.active ? 'Desativar' : 'Ativar'}
                    pendingLabel="Salvando…"
                    pending={setActive.isPending}
                    onConfirm={confirmToggle}
                    onCancel={() => setToggling(null)}
                >
                    <p>
                        {toggling.active
                            ? 'A pauta sai do sorteio das próximas assembleias e não aceita proposta nova. As assembleias já abertas continuam.'
                            : 'A pauta volta ao sorteio das próximas assembleias e a aceitar propostas.'}
                    </p>
                    <p>A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
        </main>
    )
}
