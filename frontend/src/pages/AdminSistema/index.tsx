import { useState } from 'react'
import { AdminAnnouncementsPanel } from '../../components/organisms/AdminAnnouncementsPanel'
import { AdminMaintenancePanel } from '../../components/organisms/AdminMaintenancePanel'
import type { MaintenanceFormValues } from '../../components/organisms/AdminMaintenancePanel'
import { describeAnnouncementError, localInputToIso } from '../../features/admin/announcementForm'
import type { AnnouncementFormValues } from '../../features/admin/announcementForm'
import { useAdminAnnouncementsQuery } from '../../features/admin/useAdminAnnouncementsQuery'
import {
    useCreateAnnouncementMutation,
    useEndAnnouncementMutation,
    useStartMaintenanceMutation,
    useUpdateAnnouncementMutation,
} from '../../features/admin/useAnnouncementActions'
import type { AdminAnnouncement } from '../../services/admin'
import styles from './index.module.css'

// Tela 10.17 (N.20), seção Sistema do painel: comunicados globais (faixa no topo do app do
// usuário) e modo de manutenção. A faixa nunca é conteúdo HTML: é texto puro.
export function AdminSistema() {
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [resetSignal, setResetSignal] = useState(0)

    const query = useAdminAnnouncementsQuery()
    const create = useCreateAnnouncementMutation()
    const update = useUpdateAnnouncementMutation()
    const end = useEndAnnouncementMutation()
    const maintenance = useStartMaintenanceMutation()

    const announcements = query.data ?? []
    const openMaintenance = announcements.find((a) => a.kind === 'maintenance' && a.status !== 'ended') ?? null

    function reset() {
        setNotice(null)
        setError(null)
    }

    function save(values: AnnouncementFormValues, editingId: string | null) {
        reset()
        const body = {
            title: values.title.trim(),
            body: values.body.trim(),
            severity: values.severity,
            dismissible: values.dismissible,
        }
        const startsAt = localInputToIso(values.startsAt)
        const endsAt = localInputToIso(values.endsAt)
        const onSuccess = (message: string) => () => {
            setNotice(message)
            setResetSignal((n) => n + 1)
        }
        const onError = (err: unknown) => setError(describeAnnouncementError(err))

        if (editingId) {
            // Na edição o fim vazio significa "tirar o fim" (null), e o início vazio, manter o atual.
            update.mutate(
                { id: editingId, patch: { ...body, ...(startsAt ? { starts_at: startsAt } : {}), ends_at: endsAt ?? null } },
                { onSuccess: onSuccess('Comunicado atualizado.'), onError },
            )
            return
        }
        create.mutate(
            { ...body, ...(startsAt ? { starts_at: startsAt } : {}), ends_at: endsAt ?? null },
            { onSuccess: onSuccess('Comunicado publicado.'), onError },
        )
    }

    function endOne(announcement: AdminAnnouncement) {
        reset()
        end.mutate(announcement.id, {
            onSuccess: (result) =>
                setNotice(
                    result.outcome === 'cancelled'
                        ? 'Comunicado agendado cancelado.'
                        : result.halt_lifted
                          ? 'Manutenção encerrada e negociação retomada.'
                          : 'Comunicado encerrado.',
                ),
            onError: (err) => setError(describeAnnouncementError(err)),
        })
    }

    function startMaintenance(values: MaintenanceFormValues) {
        reset()
        maintenance.mutate(
            {
                title: values.title.trim(),
                body: values.body.trim(),
                ends_at: localInputToIso(values.endsAt) ?? null,
                pause_trading: values.pauseTrading,
            },
            {
                onSuccess: () => setNotice(values.pauseTrading ? 'Manutenção iniciada e negociação pausada.' : 'Manutenção iniciada.'),
                onError: (err) => setError(describeAnnouncementError(err)),
            },
        )
    }

    return (
        <main className={styles.page}>
            <header>
                <h1 className={styles.title}>Sistema</h1>
                <p className={styles.subtitle}>
                    Comunicados que aparecem como faixa no topo do app de todos os usuários, e o modo de manutenção.
                </p>
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
            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar os comunicados agora. Tente novamente em instantes.
                </p>
            )}

            <AdminMaintenancePanel
                open={openMaintenance}
                busy={maintenance.isPending || end.isPending}
                onStart={startMaintenance}
                onEnd={endOne}
            />

            {query.isLoading && <p className={styles.loading}>Carregando comunicados…</p>}
            {query.data && (
                <AdminAnnouncementsPanel
                    key={resetSignal}
                    announcements={announcements}
                    saving={create.isPending || update.isPending}
                    endingId={end.isPending ? (end.variables ?? null) : null}
                    onSave={save}
                    onEnd={endOne}
                />
            )}
        </main>
    )
}
