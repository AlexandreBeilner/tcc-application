import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { AdminUserCorrections } from '../../components/organisms/AdminUserCorrections'
import { AdminUserDetailPanel } from '../../components/organisms/AdminUserDetailPanel'
import { SuspendUserDialog } from '../../components/organisms/SuspendUserDialog'
import { describeUserActionError, isAnonymized } from '../../features/admin/adminUsers'
import { useAdminUserDetailQuery } from '../../features/admin/useAdminUserDetailQuery'
import {
    useDeleteUserMutation,
    useForceLogoutUserMutation,
    useReactivateUserMutation,
    useSuspendUserMutation,
} from '../../features/admin/useAdminUserActions'
import { ApiError } from '../../services/client'
import styles from './index.module.css'

type Dialog = 'suspend' | 'logout' | 'delete' | null

// Tela 10.14 (N.16) — detalhe de uma conta no painel, com as ações do administrador:
// suspender (motivo obrigatório), reativar, encerrar todas as sessões e excluir a pedido
// (LGPD, digitando o username). Suspender, encerrar sessões e excluir pedem a senha de
// novo quando a conferência recente venceu (N.22). Conta de administrador não é
// suspensa nem excluída pelo painel: os botões ficam desabilitados com o motivo.
export function AdminUsuarioDetalhe() {
    const { id = '' } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [dialog, setDialog] = useState<Dialog>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)

    const detailQuery = useAdminUserDetailQuery(id)
    const suspend = useSuspendUserMutation()
    const reactivate = useReactivateUserMutation()
    const forceLogout = useForceLogoutUserMutation()
    const deleteUser = useDeleteUserMutation()

    const detail = detailQuery.data
    const account = detail?.account
    const isAdminAccount = account?.role === 'admin'
    const suspended = account?.status === 'suspended'
    const busy = suspend.isPending || reactivate.isPending || forceLogout.isPending || deleteUser.isPending

    function closeDialog() {
        setDialog(null)
        setDialogError(null)
    }

    function runSuspend(reason: string) {
        setDialogError(null)
        suspend.mutate(
            { userId: id, reason },
            {
                onSuccess: () => {
                    setNotice('Conta suspensa. As sessões abertas foram encerradas.')
                    setError(null)
                    closeDialog()
                },
                onError: (err) => setDialogError(describeUserActionError(err)),
            },
        )
    }

    function runReactivate() {
        setNotice(null)
        setError(null)
        reactivate.mutate(id, {
            onSuccess: () => setNotice('Conta reativada. A pessoa precisa entrar de novo.'),
            onError: (err) => setError(describeUserActionError(err)),
        })
    }

    function runForceLogout() {
        setNotice(null)
        setError(null)
        forceLogout.mutate(id, {
            onSuccess: () => setNotice('Sessões encerradas. A pessoa pode entrar de novo quando quiser.'),
            onError: (err) => setError(describeUserActionError(err)),
            onSettled: closeDialog,
        })
    }

    function runDelete() {
        if (!account) return
        setNotice(null)
        setError(null)
        deleteUser.mutate(
            { userId: id, confirmUsername: account.username },
            {
                onSuccess: () => navigate('/admin/usuarios', { replace: true }),
                onError: (err) => setError(describeUserActionError(err)),
                onSettled: closeDialog,
            },
        )
    }

    if (detailQuery.isError) {
        const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    {notFound ? 'Usuário não encontrado.' : 'Não foi possível carregar o usuário agora. Tente novamente em instantes.'}
                </p>
                <Link to="/admin/usuarios" className={styles.link}>
                    Voltar para Usuários
                </Link>
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        {account ? (isAnonymized(account.username) ? 'Conta excluída' : account.name) : 'Usuário'}
                    </h1>
                    {account && <p className={styles.subtitle}>@{account.username}</p>}
                </div>
                <Link to="/admin/usuarios" className={styles.link}>
                    Voltar para Usuários
                </Link>
            </header>

            {detailQuery.isLoading && <p className={styles.loading}>Carregando usuário…</p>}

            {account && (
                <>
                    <div className={styles.actions}>
                        {suspended ? (
                            <button type="button" className={styles.action} disabled={busy} onClick={runReactivate}>
                                Reativar conta
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={`${styles.action} ${styles.danger}`}
                                disabled={busy || isAdminAccount}
                                onClick={() => setDialog('suspend')}
                            >
                                Suspender conta
                            </button>
                        )}
                        <button type="button" className={styles.action} disabled={busy} onClick={() => setDialog('logout')}>
                            Encerrar sessões
                        </button>
                        <button
                            type="button"
                            className={`${styles.action} ${styles.danger}`}
                            disabled={busy || isAdminAccount}
                            onClick={() => setDialog('delete')}
                        >
                            Excluir conta (LGPD)
                        </button>
                    </div>
                    {isAdminAccount && <p className={styles.hint}>Conta de administrador não é suspensa nem excluída pelo painel.</p>}
                </>
            )}

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

            {detail && <AdminUserDetailPanel detail={detail} />}

            {account && !isAnonymized(account.username) && <AdminUserCorrections userId={id} username={account.username} />}

            {dialog === 'suspend' && account && (
                <SuspendUserDialog
                    username={account.username}
                    pending={suspend.isPending}
                    error={dialogError}
                    onConfirm={runSuspend}
                    onCancel={closeDialog}
                />
            )}
            {dialog === 'logout' && account && (
                <ConfirmDialog
                    title="Encerrar as sessões desta conta?"
                    confirmLabel="Encerrar sessões"
                    pendingLabel="Encerrando…"
                    pending={forceLogout.isPending}
                    onConfirm={runForceLogout}
                    onCancel={closeDialog}
                >
                    <p>@{account.username} perde todas as sessões abertas e precisa entrar de novo. A conta continua ativa.</p>
                </ConfirmDialog>
            )}
            {dialog === 'delete' && account && (
                <ConfirmDialog
                    title="Excluir esta conta?"
                    confirmLabel="Excluir conta"
                    pendingLabel="Excluindo…"
                    pending={deleteUser.isPending}
                    requireText={account.username}
                    onConfirm={runDelete}
                    onCancel={closeDialog}
                >
                    <p>
                        Atende a um pedido de exclusão (LGPD): nome, e-mail, username, senha, foto e logins externos são apagados e as
                        sessões encerradas. O histórico financeiro imutável continua, sem identificar a pessoa.
                    </p>
                    <p>Não dá para desfazer. A ação fica registrada na auditoria, sem o username.</p>
                </ConfirmDialog>
            )}
        </main>
    )
}
