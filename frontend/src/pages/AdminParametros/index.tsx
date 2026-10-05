import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { describeSettingError, EDITABLE_SETTING_TEXT, parseSettingInput, readOnlyTitle } from '../../features/admin/engineSettings'
import { useResetEngineSettingMutation, useUpdateEngineSettingMutation } from '../../features/admin/useEngineSettingActions'
import { useEngineSettingsQuery } from '../../features/admin/useEngineSettingsQuery'
import { formatDateTime } from '../../features/admin/timeFormat'
import type { EditableSetting } from '../../services/admin'
import styles from './index.module.css'

type Pending = { kind: 'save'; setting: EditableSetting; value: number } | { kind: 'reset'; setting: EditableSetting } | null

// Tela 10.11 (N.7) — "Parâmetros", dentro da seção Tempo. Só o ritmo do Temporizador é
// editável (decisão do autor, achado 029); regra financeira e invariante de domínio ficam
// somente leitura, sem controle. A mudança vale a partir da próxima tentativa do agendador
// e nunca no meio de um tick; o mercado é compartilhado, então passa por confirmação.
export function AdminParametros() {
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const settingsQuery = useEngineSettingsQuery()
    const update = useUpdateEngineSettingMutation()
    const reset = useResetEngineSettingMutation()
    const confirming = update.isPending || reset.isPending

    function requestSave(setting: EditableSetting) {
        setNotice(null)
        setError(null)
        const parsed = parseSettingInput(drafts[setting.key] ?? String(setting.value), setting)
        if ('error' in parsed) {
            setFieldErrors((prev) => ({ ...prev, [setting.key]: parsed.error }))
            return
        }
        setFieldErrors((prev) => ({ ...prev, [setting.key]: '' }))
        if (parsed.value === setting.value) {
            setFieldErrors((prev) => ({ ...prev, [setting.key]: 'O valor já é esse.' }))
            return
        }
        setPending({ kind: 'save', setting, value: parsed.value })
    }

    function confirmPending() {
        if (!pending) return
        const { setting } = pending
        const text = EDITABLE_SETTING_TEXT[setting.key]
        const onError = (err: unknown) => setError(describeSettingError(err))
        const onSettled = () => setPending(null)
        if (pending.kind === 'save') {
            update.mutate(
                { key: setting.key, value: pending.value },
                {
                    onSuccess: () => {
                        setNotice(`${text.title}: ${pending.value} ${text.unit}. Vale a partir do próximo tick agendado.`)
                        setDrafts((prev) => ({ ...prev, [setting.key]: '' }))
                    },
                    onError,
                    onSettled,
                },
            )
            return
        }
        reset.mutate(setting.key, {
            onSuccess: () => {
                setNotice(`${text.title} voltou ao padrão (${setting.default} ${text.unit}).`)
                setDrafts((prev) => ({ ...prev, [setting.key]: '' }))
            },
            onError,
            onSettled,
        })
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Parâmetros de simulação</h1>
                    <p className={styles.subtitle}>
                        Só o ritmo do Temporizador pode ser alterado aqui. A mudança vale a partir do próximo tick agendado, nunca no meio
                        de um, e se aplica a todos os usuários.
                    </p>
                </div>
                <Link to="/admin/tempo" className={styles.link}>
                    Voltar ao Tempo
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
            {settingsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar os parâmetros agora. Tente novamente em instantes.
                </p>
            )}
            {settingsQuery.isLoading && <p className={styles.loading}>Carregando parâmetros…</p>}

            {settingsQuery.data && (
                <>
                    <section className={styles.section} aria-label="Parâmetros editáveis">
                        <h2 className={styles.sectionTitle}>Editáveis</h2>
                        <div className={styles.cards}>
                            {settingsQuery.data.editable.map((setting) => {
                                const text = EDITABLE_SETTING_TEXT[setting.key]
                                const draft = drafts[setting.key] ?? ''
                                const fieldError = fieldErrors[setting.key]
                                return (
                                    <article key={setting.key} className={styles.card} aria-label={text.title}>
                                        <h3 className={styles.cardTitle}>{text.title}</h3>
                                        <p className={styles.effect}>{text.effect}</p>
                                        <p className={styles.current}>
                                            Atual: <strong>{setting.value}</strong> {text.unit}
                                            {setting.overridden ? ' (alterado)' : ' (padrão)'}
                                        </p>
                                        <p className={styles.meta}>
                                            Padrão {setting.default}. Faixa permitida: {setting.min} a {setting.max}.
                                            {setting.overridden && setting.updated_at
                                                ? ` Alterado em ${formatDateTime(setting.updated_at)}.`
                                                : ''}
                                        </p>
                                        <label className={styles.field}>
                                            <span>Novo valor</span>
                                            <input
                                                className={styles.input}
                                                inputMode="numeric"
                                                value={draft}
                                                placeholder={String(setting.value)}
                                                aria-invalid={fieldError ? true : undefined}
                                                onChange={(event) => setDrafts((prev) => ({ ...prev, [setting.key]: event.target.value }))}
                                            />
                                        </label>
                                        {fieldError && (
                                            <p className={styles.fieldError} role="alert">
                                                {fieldError}
                                            </p>
                                        )}
                                        <div className={styles.actions}>
                                            <Button disabled={draft.trim() === '' || confirming} onClick={() => requestSave(setting)}>
                                                Salvar
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                disabled={!setting.overridden || confirming}
                                                onClick={() => setPending({ kind: 'reset', setting })}
                                            >
                                                Restaurar padrão
                                            </Button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    </section>

                    <section className={styles.section} aria-label="Parâmetros somente leitura">
                        <h2 className={styles.sectionTitle}>Somente leitura</h2>
                        <p className={styles.hint}>
                            Regra financeira e invariante de domínio não mudam por botão. Alterar um destes é mudança de código.
                        </p>
                        <ul className={styles.readOnlyList}>
                            {settingsQuery.data.read_only.map((item) => (
                                <li key={item.key} className={styles.readOnlyItem}>
                                    <div className={styles.readOnlyHead}>
                                        <span className={styles.readOnlyTitle}>{readOnlyTitle(item.key)}</span>
                                        <span className={styles.readOnlyValue}>{item.value}</span>
                                    </div>
                                    <p className={styles.meta}>{item.reason}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                </>
            )}

            {pending && (
                <ConfirmDialog
                    title={pending.kind === 'save' ? 'Alterar o ritmo do mercado?' : 'Restaurar o padrão?'}
                    confirmLabel={pending.kind === 'save' ? 'Alterar' : 'Restaurar'}
                    pendingLabel="Salvando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    {pending.kind === 'save' ? (
                        <p>
                            {EDITABLE_SETTING_TEXT[pending.setting.key].title}: de {pending.setting.value} para {pending.value}{' '}
                            {EDITABLE_SETTING_TEXT[pending.setting.key].unit}. Afeta todos os usuários a partir do próximo tick agendado. A
                            ação fica registrada na auditoria.
                        </p>
                    ) : (
                        <p>
                            {EDITABLE_SETTING_TEXT[pending.setting.key].title} volta de {pending.setting.value} para o padrão (
                            {pending.setting.default} {EDITABLE_SETTING_TEXT[pending.setting.key].unit}). A ação fica registrada na
                            auditoria.
                        </p>
                    )}
                </ConfirmDialog>
            )}
        </main>
    )
}
