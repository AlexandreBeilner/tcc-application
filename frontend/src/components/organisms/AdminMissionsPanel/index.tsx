import { useId, useState } from 'react'
import {
    describeCatalogError,
    MAX_MISSION_DESCRIPTION_LENGTH,
    MAX_MISSION_TITLE_LENGTH,
    MAX_MISSION_XP_REWARD,
    MIN_MISSION_XP_REWARD,
    MISSION_VERIFICATION_LABELS,
    parseMissionXp,
} from '../../../features/admin/gamificationCatalog'
import { useMissionCatalogQuery, useUpdateMissionMutation } from '../../../features/admin/useGamificationCatalog'
import type { CatalogMission } from '../../../services/admin'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

type Dialog = { kind: 'edit'; mission: CatalogMission } | { kind: 'deactivate'; mission: CatalogMission } | null

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
    const id = useId()
    return (
        <label htmlFor={id} className={styles.field}>
            <span>{label}</span>
            {children(id)}
        </label>
    )
}

interface MissionEditDialogProps {
    mission: CatalogMission
    pending: boolean
    error: string | null
    onSubmit: (changes: { title: string; description: string | null; xp_reward: number }) => void
    onCancel: () => void
}

// Edição de uma missão (N.19): texto e XP. O tipo (como a conclusão é conferida) é código e não se edita.
function MissionEditDialog({ mission, pending, error, onSubmit, onCancel }: MissionEditDialogProps) {
    const [title, setTitle] = useState(mission.title)
    const [description, setDescription] = useState(mission.description ?? '')
    const [xp, setXp] = useState(String(mission.xp_reward))
    const parsedXp = parseMissionXp(xp)
    const valid = title.trim().length > 0 && parsedXp !== null

    return (
        <ConfirmDialog
            title="Editar missão"
            confirmLabel="Salvar"
            pendingLabel="Salvando…"
            pending={pending}
            confirmDisabled={!valid}
            onConfirm={() => valid && onSubmit({ title: title.trim(), description: description.trim() || null, xp_reward: parsedXp })}
            onCancel={onCancel}
        >
            <Field label="Título">
                {(id) => (
                    <input
                        id={id}
                        className={styles.input}
                        value={title}
                        maxLength={MAX_MISSION_TITLE_LENGTH}
                        disabled={pending}
                        onChange={(event) => setTitle(event.target.value)}
                    />
                )}
            </Field>
            <Field label="Descrição">
                {(id) => (
                    <textarea
                        id={id}
                        className={styles.input}
                        rows={3}
                        value={description}
                        maxLength={MAX_MISSION_DESCRIPTION_LENGTH}
                        disabled={pending}
                        onChange={(event) => setDescription(event.target.value)}
                    />
                )}
            </Field>
            <Field label={`XP (${MIN_MISSION_XP_REWARD} a ${MAX_MISSION_XP_REWARD})`}>
                {(id) => (
                    <input
                        id={id}
                        className={styles.input}
                        inputMode="numeric"
                        value={xp}
                        disabled={pending}
                        onChange={(event) => setXp(event.target.value)}
                    />
                )}
            </Field>
            <p className={styles.hint}>
                Conferência: {MISSION_VERIFICATION_LABELS[mission.verification]}. Isso é regra do sistema e não muda por aqui. O XP novo
                vale para quem concluir a partir de agora.
            </p>
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
        </ConfirmDialog>
    )
}

// Missões diárias do catálogo (N.19): texto, tipo (só leitura), XP, status e quantos usuários concluíram (no
// total e hoje). Missão desativada deixa de ser sorteada pro dia e de poder ser concluída; o que já foi
// concluído fica como está. Não há "nova missão": cada tipo de conferência é código, e uma missão sem
// conferência seria XP de graça. Tabela no tablet e no desktop, cartões no mobile.
export function AdminMissionsPanel() {
    const catalogQuery = useMissionCatalogQuery()
    const update = useUpdateMissionMutation()
    const [dialog, setDialog] = useState<Dialog>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const missions = catalogQuery.data

    function closeDialog() {
        setDialog(null)
        setDialogError(null)
    }

    function submitEdit(mission: CatalogMission, changes: { title: string; description: string | null; xp_reward: number }) {
        setDialogError(null)
        update.mutate(
            { id: mission.id, changes },
            {
                onSuccess: () => {
                    setNotice(`Missão "${changes.title}" atualizada.`)
                    setError(null)
                    closeDialog()
                },
                onError: (err) => setDialogError(describeCatalogError(err)),
            },
        )
    }

    function setActive(mission: CatalogMission, isActive: boolean) {
        update.mutate(
            { id: mission.id, changes: { is_active: isActive } },
            {
                onSuccess: () => {
                    setNotice(isActive ? `Missão "${mission.title}" reativada.` : `Missão "${mission.title}" desativada.`)
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

    const status = (mission: CatalogMission) => (
        <span className={`${styles.badge} ${mission.is_active ? '' : styles.dashed}`}>{mission.is_active ? 'Ativa' : 'Desativada'}</span>
    )
    const actions = (mission: CatalogMission) => (
        <div className={styles.rowActions}>
            <button type="button" className={styles.link} disabled={update.isPending} onClick={() => setDialog({ kind: 'edit', mission })}>
                Editar
            </button>
            {mission.is_active ? (
                <button
                    type="button"
                    className={styles.link}
                    disabled={update.isPending}
                    onClick={() => setDialog({ kind: 'deactivate', mission })}
                >
                    Desativar
                </button>
            ) : (
                <button type="button" className={styles.link} disabled={update.isPending} onClick={() => setActive(mission, true)}>
                    Reativar
                </button>
            )}
        </div>
    )
    const completions = (mission: CatalogMission) => `${mission.completed_users} no total, ${mission.completed_today} hoje`

    return (
        <section className={styles.root} aria-label="Missões diárias">
            <p className={styles.intro}>
                Desativar uma missão a tira do sorteio do dia e impede novas conclusões. O que já foi concluído, e o XP dado, continua como
                está.
            </p>

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
            {catalogQuery.isLoading && <p className={styles.muted}>Carregando missões…</p>}
            {catalogQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as missões agora.
                </p>
            )}

            {missions && missions.length === 0 && <p className={styles.muted}>Nenhuma missão cadastrada.</p>}

            {missions && missions.length > 0 && (
                <div className={styles.wrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {['Missão', 'Conferência', 'XP', 'Concluíram', 'Status', ''].map((header, index) => (
                                    <th key={index} className={styles.th}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {missions.map((mission) => (
                                <tr key={mission.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.name}>{mission.title}</div>
                                        {mission.description && <div className={styles.sub}>{mission.description}</div>}
                                    </td>
                                    <td className={styles.td}>{MISSION_VERIFICATION_LABELS[mission.verification]}</td>
                                    <td className={styles.td}>{mission.xp_reward}</td>
                                    <td className={styles.td}>{completions(mission)}</td>
                                    <td className={styles.td}>{status(mission)}</td>
                                    <td className={styles.td}>{actions(mission)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <ul className={styles.cards}>
                        {missions.map((mission) => (
                            <li key={mission.id} className={styles.card}>
                                <div className={styles.name}>{mission.title}</div>
                                {mission.description && <div className={styles.sub}>{mission.description}</div>}
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Conferência</span>
                                    <span>{MISSION_VERIFICATION_LABELS[mission.verification]}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>XP</span>
                                    <span>{mission.xp_reward}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Concluíram</span>
                                    <span>{completions(mission)}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Status</span>
                                    {status(mission)}
                                </div>
                                {actions(mission)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {dialog?.kind === 'edit' && (
                <MissionEditDialog
                    mission={dialog.mission}
                    pending={update.isPending}
                    error={dialogError}
                    onSubmit={(changes) => submitEdit(dialog.mission, changes)}
                    onCancel={closeDialog}
                />
            )}
            {dialog?.kind === 'deactivate' && (
                <ConfirmDialog
                    title="Desativar esta missão?"
                    confirmLabel="Desativar"
                    pendingLabel="Desativando…"
                    pending={update.isPending}
                    onConfirm={() => setActive(dialog.mission, false)}
                    onCancel={closeDialog}
                >
                    <p>
                        A missão <strong>{dialog.mission.title}</strong> sai do sorteio do dia e deixa de aparecer para os usuários.
                    </p>
                    <p>Quem já concluiu mantém o XP e o streak. Dá para reativar a qualquer momento.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
