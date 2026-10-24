import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { LeagueInvitePanel } from '../../components/organisms/LeagueInvitePanel'
import { LeagueStandings } from '../../components/organisms/LeagueStandings'
import {
    useCloseLeagueMutation,
    useLeagueQuery,
    useLeaveLeagueMutation,
    useRemoveLeagueMemberMutation,
    useRenameLeagueMutation,
    useRespondToLeagueInvitationMutation,
} from '../../features/leagues/useLeagues'
import { ApiError } from '../../services/client'
import { formatApiError } from '../../utils/formatApiError'
import { formatUpdatedAgo } from '../../utils/formatUpdatedAgo'
import styles from './index.module.css'

const WINDOW_LABEL = { week: 'semana', month: 'mês' } as const

// Detalhe da liga (MO.5.2c): a classificação por rentabilidade percentual do período e, para o
// dono, o gerenciamento (renomear, convidar, tirar, encerrar).
export function LigaDetalhe() {
    const { id = '' } = useParams()
    const navigate = useNavigate()
    const query = useLeagueQuery(id)
    const respond = useRespondToLeagueInvitationMutation()
    const leave = useLeaveLeagueMutation()
    const close = useCloseLeagueMutation()
    const remove = useRemoveLeagueMemberMutation()
    const rename = useRenameLeagueMutation()
    const [confirming, setConfirming] = useState<'leave' | 'close' | null>(null)
    const [newName, setNewName] = useState('')
    const [renaming, setRenaming] = useState(false)

    if (query.isError) {
        const notFound = query.error instanceof ApiError && query.error.status === 404
        return (
            <main className={styles.page}>
                <Link to="/ligas" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Ligas
                </Link>
                <p className={styles.error} role="alert">
                    {notFound ? 'Liga não encontrada. Ela pode ter sido encerrada.' : 'Não foi possível carregar a liga agora.'}
                </p>
            </main>
        )
    }
    if (!query.data) {
        return (
            <main className={styles.page}>
                <p className={styles.muted}>Carregando liga…</p>
            </main>
        )
    }

    const { league, standings, pendingInvites, updatedAt } = query.data
    const invited = league.status === 'invited'
    const takenIds = [...standings.map((s) => s.userId), ...pendingInvites.map((p) => p.userId)]

    async function submitRename(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        try {
            await rename.mutateAsync({ id, name: newName })
            setRenaming(false)
        } catch {
            // o erro aparece abaixo
        }
    }

    const renameError = rename.isError ? formatApiError(rename.error, 'Não foi possível renomear. Tente de novo.') : null

    return (
        <main className={styles.page}>
            <Link to="/ligas" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Ligas
            </Link>

            <header className={styles.header}>
                <h1 className={styles.title}>{league.name}</h1>
                <p className={styles.meta}>
                    Rentabilidade da {WINDOW_LABEL[league.window]} · {league.memberCount} {league.memberCount === 1 ? 'pessoa' : 'pessoas'}{' '}
                    · {league.isOwner ? 'criada por você' : `de @${league.ownerUsername}`}
                </p>
            </header>

            <div className={styles.layout}>
                <div className={styles.main}>
                    {invited ? (
                        <section className={styles.invite} aria-label="Convite">
                            <p className={styles.inviteText}>
                                <strong>@{league.ownerUsername}</strong> convidou você para esta liga.
                            </p>
                            <div className={styles.row}>
                                <Button disabled={respond.isPending} onClick={() => respond.mutate({ id, accept: true })}>
                                    Aceitar
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={respond.isPending}
                                    onClick={() => respond.mutate({ id, accept: false }, { onSuccess: () => navigate('/ligas') })}
                                >
                                    Recusar
                                </Button>
                            </div>
                        </section>
                    ) : (
                        <>
                            <LeagueStandings
                                standings={standings}
                                onRemove={league.isOwner ? (userId) => remove.mutate({ id, userId }) : undefined}
                                removingId={remove.isPending ? (remove.variables?.userId ?? null) : null}
                            />
                            <p className={styles.muted}>
                                Só a rentabilidade percentual conta; ninguém vê o patrimônio do outro.
                                {updatedAt && ` ${formatUpdatedAgo(updatedAt)}, a classificação é recalculada a cada 3 horas.`}
                            </p>
                        </>
                    )}
                </div>

                <aside className={styles.side}>
                    {league.isOwner && !invited && (
                        <>
                            <LeagueInvitePanel
                                leagueId={id}
                                takenUserIds={takenIds}
                                pendingInvites={pendingInvites}
                                onCancelInvite={(userId) => remove.mutate({ id, userId })}
                            />

                            <section className={styles.panel} aria-labelledby="league-manage-title">
                                <h2 id="league-manage-title" className={styles.panelTitle}>
                                    Gerenciar
                                </h2>
                                {renaming ? (
                                    <form className={styles.renameForm} onSubmit={submitRename}>
                                        <label className={styles.field}>
                                            Novo nome
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={(event) => setNewName(event.target.value)}
                                                minLength={3}
                                                maxLength={40}
                                                required
                                            />
                                        </label>
                                        <div className={styles.row}>
                                            <Button type="submit" disabled={rename.isPending}>
                                                Salvar
                                            </Button>
                                            <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setNewName(league.name)
                                            setRenaming(true)
                                        }}
                                    >
                                        Renomear
                                    </Button>
                                )}
                                {renameError && (
                                    <p className={styles.error} role="alert">
                                        {renameError}
                                    </p>
                                )}
                                <Button variant="secondary" onClick={() => setConfirming('close')}>
                                    Encerrar liga
                                </Button>
                            </section>
                        </>
                    )}

                    {!league.isOwner && (
                        <Button variant="secondary" onClick={() => setConfirming('leave')}>
                            {invited ? 'Recusar convite' : 'Sair da liga'}
                        </Button>
                    )}
                </aside>
            </div>

            {confirming === 'leave' && (
                <ConfirmDialog
                    title="Sair da liga?"
                    confirmLabel="Sair"
                    pending={leave.isPending}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => leave.mutate(id, { onSuccess: () => navigate('/ligas') })}
                >
                    Você deixa de aparecer na classificação de {league.name}. Para voltar, precisa de um novo convite.
                </ConfirmDialog>
            )}
            {confirming === 'close' && (
                <ConfirmDialog
                    title="Encerrar a liga?"
                    confirmLabel="Encerrar liga"
                    pending={close.isPending}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => close.mutate(id, { onSuccess: () => navigate('/ligas') })}
                >
                    A liga {league.name} deixa de aparecer para todos e você libera uma das suas 3 vagas. Nada é apagado.
                </ConfirmDialog>
            )}
        </main>
    )
}
