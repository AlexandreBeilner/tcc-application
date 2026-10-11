import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { ASSEMBLY_SETTING_TEXT, describeAssemblyError } from '../../features/admin/assemblies'
import { describeSettingError, EDITABLE_SETTING_TEXT, parseSettingInput } from '../../features/admin/engineSettings'
import { formatDateTime } from '../../features/admin/timeFormat'
import { useResetEngineSettingMutation, useUpdateEngineSettingMutation } from '../../features/admin/useEngineSettingActions'
import { useEngineSettingsQuery } from '../../features/admin/useEngineSettingsQuery'
import {
    useAssemblySettingsQuery,
    useResetAssemblySettingMutation,
    useUpdateAssemblySettingMutation,
} from '../../features/admin/useAssemblySettings'
import type { AssemblySettingKey, EngineSettingKey } from '../../services/admin'
import styles from './index.module.css'

// Um cartão editável: o backend (`assembly`) e o motor (`engine`) guardam parâmetros diferentes,
// mas a tela os trata igual.
interface Row {
    source: 'assembly' | 'engine'
    key: AssemblySettingKey | EngineSettingKey
    title: string
    unit: string
    effect: string
    value: number
    default: number
    min: number
    max: number
    overridden: boolean
    updatedAt: string | null
}

type Pending = { kind: 'save'; row: Row; value: number } | { kind: 'reset'; row: Row } | null

// Parâmetros das assembleias do painel (MO.6.8). A edição vale para as PRÓXIMAS assembleias: a que já
// está aberta mantém o mínimo de votantes e as datas com que abriu, e uma decisão já aplicada no motor
// não muda. Alterar e restaurar passam pela auditoria.
export function AdminAssembleiaParametros() {
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const assemblyQuery = useAssemblySettingsQuery()
    const engineQuery = useEngineSettingsQuery('governance')
    const updateAssembly = useUpdateAssemblySettingMutation()
    const resetAssembly = useResetAssemblySettingMutation()
    const updateEngine = useUpdateEngineSettingMutation()
    const resetEngine = useResetEngineSettingMutation()
    const confirming = updateAssembly.isPending || resetAssembly.isPending || updateEngine.isPending || resetEngine.isPending

    const assemblyRows: Row[] = (assemblyQuery.data ?? []).map((s) => ({
        source: 'assembly',
        key: s.key,
        ...ASSEMBLY_SETTING_TEXT[s.key],
        value: s.value,
        default: s.default,
        min: s.min,
        max: s.max,
        overridden: s.overridden,
        updatedAt: s.updated_at,
    }))
    const engineRows: Row[] = (engineQuery.data?.editable ?? []).map((s) => ({
        source: 'engine',
        key: s.key,
        ...EDITABLE_SETTING_TEXT[s.key],
        value: s.value,
        default: s.default,
        min: s.min,
        max: s.max,
        overridden: s.overridden,
        updatedAt: s.updated_at,
    }))

    function requestSave(row: Row) {
        setNotice(null)
        setError(null)
        const parsed = parseSettingInput(drafts[row.key] ?? String(row.value), row)
        if ('error' in parsed) {
            setFieldErrors((prev) => ({ ...prev, [row.key]: parsed.error }))
            return
        }
        if (parsed.value === row.value) {
            setFieldErrors((prev) => ({ ...prev, [row.key]: 'O valor já é esse.' }))
            return
        }
        setFieldErrors((prev) => ({ ...prev, [row.key]: '' }))
        setPending({ kind: 'save', row, value: parsed.value })
    }

    function confirmPending() {
        if (!pending) return
        const { row } = pending
        const onError = (err: unknown) => setError(row.source === 'engine' ? describeSettingError(err) : describeAssemblyError(err))
        const onSettled = () => setPending(null)
        const clear = () => setDrafts((prev) => ({ ...prev, [row.key]: '' }))
        if (pending.kind === 'save') {
            const onSuccess = () => {
                setNotice(`${row.title}: ${pending.value} ${row.unit}. Vale para as próximas assembleias.`)
                clear()
            }
            if (row.source === 'assembly') {
                updateAssembly.mutate({ key: row.key as AssemblySettingKey, value: pending.value }, { onSuccess, onError, onSettled })
            } else {
                updateEngine.mutate({ key: row.key as EngineSettingKey, value: pending.value }, { onSuccess, onError, onSettled })
            }
            return
        }
        const onSuccess = () => {
            setNotice(`${row.title} voltou ao padrão (${row.default} ${row.unit}).`)
            clear()
        }
        if (row.source === 'assembly') {
            resetAssembly.mutate(row.key as AssemblySettingKey, { onSuccess, onError, onSettled })
        } else {
            resetEngine.mutate(row.key as EngineSettingKey, { onSuccess, onError, onSettled })
        }
    }

    function renderCards(rows: Row[]) {
        return (
            <div className={styles.cards}>
                {rows.map((row) => {
                    const draft = drafts[row.key] ?? ''
                    const fieldError = fieldErrors[row.key]
                    return (
                        <article key={row.key} className={styles.card} aria-label={row.title}>
                            <h3 className={styles.cardTitle}>{row.title}</h3>
                            <p className={styles.text}>{row.effect}</p>
                            <p className={styles.current}>
                                Atual: <strong>{row.value}</strong> {row.unit}
                                {row.overridden ? ' (alterado)' : ' (padrão)'}
                            </p>
                            <p className={styles.meta}>
                                Padrão {row.default}. Faixa permitida: {row.min} a {row.max}.
                                {row.overridden && row.updatedAt ? ` Alterado em ${formatDateTime(row.updatedAt)}.` : ''}
                            </p>
                            <label className={styles.field}>
                                <span>Novo valor</span>
                                <input
                                    className={styles.input}
                                    inputMode="numeric"
                                    value={draft}
                                    placeholder={String(row.value)}
                                    aria-invalid={fieldError ? true : undefined}
                                    onChange={(event) => setDrafts((prev) => ({ ...prev, [row.key]: event.target.value }))}
                                />
                            </label>
                            {fieldError && (
                                <p className={styles.fieldError} role="alert">
                                    {fieldError}
                                </p>
                            )}
                            <div className={styles.actions}>
                                <Button disabled={draft.trim() === '' || confirming} onClick={() => requestSave(row)}>
                                    Salvar
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={!row.overridden || confirming}
                                    onClick={() => setPending({ kind: 'reset', row })}
                                >
                                    Restaurar padrão
                                </Button>
                            </div>
                        </article>
                    )
                })}
            </div>
        )
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Parâmetros das assembleias</h1>
                    <p className={styles.subtitle}>
                        A mudança vale para as próximas assembleias. A que já está aberta mantém o mínimo de votantes e as datas com que
                        abriu, e uma decisão já aplicada no motor não muda. Sem valor gravado, vale o padrão do servidor.
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

            <section className={styles.section} aria-label="Regras da votação">
                <h2 className={styles.sectionTitle}>Votação, prazos e recompensas</h2>
                {assemblyQuery.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar os parâmetros agora. Tente novamente em instantes.
                    </p>
                )}
                {assemblyQuery.isLoading && <p className={styles.loading}>Carregando parâmetros…</p>}
                {renderCards(assemblyRows)}
            </section>

            <section className={styles.section} aria-label="Efeito no mercado">
                <h2 className={styles.sectionTitle}>Efeito nas empresas (motor)</h2>
                <p className={styles.text}>
                    O motor aplica cada decisão com os valores do momento em que a recebe. Mudar aqui não altera o que já foi aplicado.
                </p>
                {engineQuery.isError && (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar os parâmetros do motor agora. Tente novamente em instantes.
                    </p>
                )}
                {engineQuery.isLoading && <p className={styles.loading}>Carregando parâmetros do motor…</p>}
                {renderCards(engineRows)}
            </section>

            {pending?.kind === 'save' && (
                <ConfirmDialog
                    title={`Alterar ${pending.row.title.toLowerCase()}?`}
                    confirmLabel="Alterar"
                    pendingLabel="Salvando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        De {pending.row.value} para {pending.value} {pending.row.unit}. Vale para as próximas assembleias e para todos os
                        usuários. A ação fica registrada na auditoria.
                    </p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'reset' && (
                <ConfirmDialog
                    title={`Restaurar ${pending.row.title.toLowerCase()}?`}
                    confirmLabel="Restaurar"
                    pendingLabel="Restaurando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Volta para {pending.row.default} {pending.row.unit}, o padrão do servidor. Vale para as próximas assembleias.
                    </p>
                </ConfirmDialog>
            )}
        </main>
    )
}
