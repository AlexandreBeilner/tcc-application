import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ProfileAboutPanel } from '../../components/molecules/ProfileAboutPanel'
import { PublicProfileCard } from '../../components/organisms/PublicProfileCard'
import { useAuth } from '../../features/auth/AuthContext'
import { useAllFriendRequestsQuery } from '../../features/friendships/useAllFriendRequestsQuery'
import { useAllFriendsQuery } from '../../features/friendships/useAllFriendsQuery'
import { usePublicProfileQuery } from '../../features/profile/usePublicProfileQuery'
import styles from './index.module.css'

// Tela 8.4 — acessada a partir da Classificação (7.1) ou de Amigos (8.1).
// `id` inexistente cai no mesmo caminho de erro genérico de
// `CompanyProfile` (6.5) — `.docs/backend/profile.md` devolve `404`, sem
// distinguir a mensagem disso de uma falha de rede qualquer. Composição de
// página (tarefa 6.9.5, retrofit da 6.9.2) — `PublicProfileCard` continua
// exatamente como foi redesenhado na 6.9.2, sem nenhuma prop nova; o que
// muda aqui é só o entorno: link de volta, layout 2 colunas em desktop
// (conteúdo principal + `ProfileAboutPanel` sticky, `identidade-visual-
// padroes.md` §7) e o mesmo painel empilhado (sem sticky) em mobile —
// mockup aprovado pelo autor antes de implementar, mesmo critério da 6.9.2.
export function PerfilPublico() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const profileQuery = usePublicProfileQuery(id as string)
    const friendsQuery = useAllFriendsQuery()
    const requestsQuery = useAllFriendRequestsQuery()

    if (profileQuery.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar este perfil agora. Tente novamente em instantes.
                </p>
            </main>
        )
    }

    if (!profileQuery.data || !user) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando perfil…</p>
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <Link to="/amigos" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Amigos
            </Link>

            <div className={styles.layout}>
                <div className={styles.main}>
                    <PublicProfileCard
                        profile={profileQuery.data.profile}
                        currentUserId={user.id}
                        targetUserId={id as string}
                        friends={friendsQuery.data ?? []}
                        sentRequests={requestsQuery.data?.sent ?? []}
                        receivedRequests={requestsQuery.data?.received ?? []}
                    />
                </div>

                <aside className={styles.sidebar}>
                    <ProfileAboutPanel />
                </aside>
            </div>
        </main>
    )
}
