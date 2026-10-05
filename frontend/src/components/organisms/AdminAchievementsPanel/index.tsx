import { useId, useState } from 'react'
import {
    criteriaValueToInput,
    describeCatalogError,
    formatCriteriaValue,
    MAX_ACHIEVEMENT_DESCRIPTION_LENGTH,
    MAX_ACHIEVEMENT_NAME_LENGTH,
    parseCriteriaValue,
} from '../../../features/admin/gamificationCatalog'
import {
    useAchievementCatalogQuery,
    useCreateAchievementMutation,
    useUpdateAchievementMutation,
} from '../../../features/admin/useGamificationCatalog'
import type { AchievementCriteriaType, AchievementCriterionOption, CatalogAchievement } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

type Dialog = { kind: 'form'; achievement: CatalogAchievement | null } | { kind: 'deactivate'; achievement: CatalogAchievement } | null

interface FormValues {
    name: string
    description: string
    criteriaType: AchievementCriteriaType
    value: string
}

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
    const id = useId()
    return (
        <label htmlFor={id} className={styles.field}>
            <span>{label}</span>
            {children(id)}
        </label>
    )
}

interface AchievementFormDialogProps {
    achievement: CatalogAchievement | null
    criteria: AchievementCriterionOption[]
    pending: boolean
    error: string | null
    onSubmit: (values: { name: string; description: string | null; criteria_type: AchievementCriteriaType; criteria_value: number }) => void
    onCancel: () => void
}

// Criar ou editar uma conquista (N.19). O critério é uma das regras fechadas que o código sabe
// avaliar (nunca uma expressão livre); a meta aceita inteiro nos critérios de contagem e reais no
// patrimônio. Mudar a meta ou o critério só vale pras próximas concessões: ninguém perde o que ganhou.
function AchievementFormDialog({ achievement, criteria, pending, error, onSubmit, onCancel }: AchievementFormDialogProps) {
    const [values, setValues] = useState<FormValues>({
        name: achievement?.name ?? '',
        description: achievement?.description ?? '',
        criteriaType: achievement?.criteria_type ?? criteria[0]?.type ?? 'streak_days',
        value: achievement ? criteriaValueToInput(achievement.criteria_value) : '',
    })
    const criterion = criteria.find((c) => c.type === values.criteriaType)
    const kind = criterion?.value_kind ?? 'integer'
    const parsedValue = parseCriteriaValue(values.value, kind)
    const valid = values.name.trim().length > 0 && parsedValue !== null

    const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }))

    return (
        <ConfirmDialog
            title={achievement ? 'Editar conquista' : 'Nova conquista'}
            confirmLabel={achievement ? 'Salvar' : 'Criar conquista'}
            pendingLabel="Salvando…"
            pending={pending}
            confirmDisabled={!valid}
            onConfirm={() =>
                valid &&
                onSubmit({
                    name: values.name.trim(),
                    description: values.description.trim() || null,
                    criteria_type: values.criteriaType,
                    criteria_value: parsedValue,
                })
            }
            onCancel={onCancel}
        >
            <Field label="Nome">
                {(id) => (
                    <input
                        id={id}
                        className={styles.input}
                        value={values.name}
                        maxLength={MAX_ACHIEVEMENT_NAME_LENGTH}
                        disabled={pending}
                        onChange={(event) => set('name', event.target.value)}
                    />
                )}
            </Field>
            <Field label="Descrição">
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={2}
                        value={values.description}
                        maxLength={MAX_ACHIEVEMENT_DESCRIPTION_LENGTH}
                        disabled={pending}
                        onChange={(event) => set('description', event.target.value)}
                    />
                )}
            </Field>
            <Field label="Regra de desbloqueio">
                {(id) => (
                    <select
                        id={id}
                        className={styles.input}
                        value={values.criteriaType}
                        disabled={pending}
                        onChange={(event) => set('criteriaType', event.target.value as AchievementCriteriaType)}
                    >
                        {criteria.map((c) => (
                            <option key={c.type} value={c.type}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                )}
            </Field>
            <Field label={kind === 'currency' ? 'Meta (R$)' : 'Meta (quantidade)'}>
                {(id) => (
                    <input
                        id={id}
                        className={styles.input}
                        inputMode={kind === 'currency' ? 'decimal' : 'numeric'}
                        placeholder={kind === 'currency' ? '12.000,00' : '7'}
                        value={values.value}
                        disabled={pending}
                        onChange={(event) => set('value', event.target.value)}
                    />
                )}
            </Field>
            <p className={styles.hint}>
                A regra é escolhida entre as que o sistema sabe avaliar. Mudar meta ou regra vale só para as próximas concessões, ninguém
                perde o que já ganhou.
            </p>
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
        </ConfirmDialog>
    )
}

// Conquistas do catálogo (N.19): lista com a regra, a meta e quantos usuários já ganharam cada uma, criar,
// editar e ativar ou desativar. Desativada deixa de ser concedida e some da lista de quem ainda não a tem,
// mas nunca é tirada de quem já ganhou. Tabela no tablet e no desktop, cartões no mobile.
export function AdminAchievementsPanel() {
    const catalogQuery = useAchievementCatalogQuery()
    const create = useCreateAchievementMutation()
    const update = useUpdateAchievementMutation()
    const [dialog, setDialog] = useState<Dialog>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const catalog = catalogQuery.data
    const criteria = catalog?.criteria ?? []
    const kindOf = (type: AchievementCriteriaType) => criteria.find((c) => c.type === type)?.value_kind ?? 'integer'
    const labelOf = (type: AchievementCriteriaType) => criteria.find((c) => c.type === type)?.label ?? type
    const busy = create.isPending || update.isPending

    function closeDialog() {
        setDialog(null)
        setDialogError(null)
    }

    function submitForm(achievement: CatalogAchievement | null, values: Parameters<AchievementFormDialogProps['onSubmit']>[0]) {
        setDialogError(null)
        const done = (message: string) => {
            setNotice(message)
            setError(null)
            closeDialog()
        }
        if (achievement) {
            update.mutate(
                { id: achievement.id, changes: values },
                {
                    onSuccess: () => done(`Conquista "${values.name}" atualizada.`),
                    onError: (err) => setDialogError(describeCatalogError(err)),
                },
            )
            return
        }
        create.mutate(values, {
            onSuccess: () => done(`Conquista "${values.name}" criada.`),
            onError: (err) => setDialogError(describeCatalogError(err)),
        })
    }

    function setActive(achievement: CatalogAchievement, isActive: boolean) {
        update.mutate(
            { id: achievement.id, changes: { is_active: isActive } },
            {
                onSuccess: () => {
                    setNotice(isActive ? `Conquista "${achievement.name}" reativada.` : `Conquista "${achievement.name}" desativada.`)
                    setError(null)
                },
                onError: (err) => {
                    setNotice(null)
                    setError(describeCatalogError(err))
                },
                onSettled: closeDialog,
            },
        )
    }

    const status = (achievement: CatalogAchievement) => (
        <span className={`${styles.badge} ${achievement.is_active ? '' : styles.dashed}`}>
            {achievement.is_active ? 'Ativa' : 'Desativada'}
        </span>
    )
    const actions = (achievement: CatalogAchievement) => (
        <div className={styles.rowActions}>
            <button type="button" className={styles.link} disabled={busy} onClick={() => setDialog({ kind: 'form', achievement })}>
                Editar
            </button>
            {achievement.is_active ? (
                <button
                    type="button"
                    className={styles.link}
                    disabled={busy}
                    onClick={() => setDialog({ kind: 'deactivate', achievement })}
                >
                    Desativar
                </button>
            ) : (
                <button type="button" className={styles.link} disabled={busy} onClick={() => setActive(achievement, true)}>
                    Reativar
                </button>
            )}
        </div>
    )
    const rule = (achievement: CatalogAchievement) =>
        `${labelOf(achievement.criteria_type)}: ${formatCriteriaValue(achievement.criteria_value, kindOf(achievement.criteria_type))}`

    return (
        <section className={styles.root} aria-label="Conquistas">
            <div className={styles.toolbar}>
                <p className={styles.intro}>
                    Desativar uma conquista só impede novas concessões. Quem já ganhou continua com ela, no perfil e na lista.
                </p>
                <Button onClick={() => setDialog({ kind: 'form', achievement: null })} disabled={!catalog || busy}>
                    Nova conquista
                </Button>
            </div>

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
            {catalogQuery.isLoading && <p className={styles.muted}>Carregando conquistas…</p>}
            {catalogQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as conquistas agora.
                </p>
            )}

            {catalog && catalog.achievements.length === 0 && <p className={styles.muted}>Nenhuma conquista cadastrada.</p>}

            {catalog && catalog.achievements.length > 0 && (
                <div className={styles.wrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {['Conquista', 'Regra e meta', 'Ganharam', 'Status', ''].map((header, index) => (
                                    <th key={index} className={styles.th}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {catalog.achievements.map((achievement) => (
                                <tr key={achievement.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.name}>{achievement.name}</div>
                                        {achievement.description && <div className={styles.sub}>{achievement.description}</div>}
                                    </td>
                                    <td className={styles.td}>{rule(achievement)}</td>
                                    <td className={styles.td}>{achievement.unlocked_count}</td>
                                    <td className={styles.td}>{status(achievement)}</td>
                                    <td className={styles.td}>{actions(achievement)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <ul className={styles.cards}>
                        {catalog.achievements.map((achievement) => (
                            <li key={achievement.id} className={styles.card}>
                                <div className={styles.name}>{achievement.name}</div>
                                {achievement.description && <div className={styles.sub}>{achievement.description}</div>}
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Regra e meta</span>
                                    <span>{rule(achievement)}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Ganharam</span>
                                    <span>{achievement.unlocked_count}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Status</span>
                                    {status(achievement)}
                                </div>
                                {actions(achievement)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {dialog?.kind === 'form' && (
                <AchievementFormDialog
                    achievement={dialog.achievement}
                    criteria={criteria}
                    pending={busy}
                    error={dialogError}
                    onSubmit={(values) => submitForm(dialog.achievement, values)}
                    onCancel={closeDialog}
                />
            )}
            {dialog?.kind === 'deactivate' && (
                <ConfirmDialog
                    title="Desativar esta conquista?"
                    confirmLabel="Desativar"
                    pendingLabel="Desativando…"
                    pending={update.isPending}
                    onConfirm={() => setActive(dialog.achievement, false)}
                    onCancel={closeDialog}
                >
                    <p>
                        A conquista <strong>{dialog.achievement.name}</strong> deixa de ser concedida e some da lista de quem ainda não a
                        tem.
                    </p>
                    <p>
                        Os {dialog.achievement.unlocked_count} usuário(s) que já a ganharam continuam com ela. Dá para reativar a qualquer
                        momento.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}
