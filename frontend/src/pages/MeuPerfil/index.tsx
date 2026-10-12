import { Link, useNavigate } from 'react-router-dom'
import { ProfileAboutPanel } from '../../components/molecules/ProfileAboutPanel'
import { PublicProfileCard } from '../../components/organisms/PublicProfileCard'
import { useAuth } from '../../features/auth/AuthContext'
import { useMyProfileQuery } from '../../features/profile/useMyProfileQuery'
import styles from './index.module.css'

// Tela 9.1 "Meu Perfil" (tarefa 6.10) — reaproveita `PublicProfileCard`
// (6.9.2) exatamente como projetado: `currentUserId === targetUserId`
// resolve pra `status: 'self'` em `resolveFriendshipStatus` antes mesmo de
// olhar pras listas de amizade, então `friends`/`sentRequests`/
// `receivedRequests` entram vazios de propósito — nenhuma query de
// amizade nova só pra esta tela. Mesma composição 2 colunas de
// `PerfilPublico` (8.4, `main` + `ProfileAboutPanel` sticky em desktop),
// já que o conteúdo é o mesmo card. "Editar perfil" (inventário) navega
// pra 9.2 Configurações de Conta.
export function MeuPerfil() {
    const { user } = useAuth()
    const profileQuery = useMyProfileQuery()
    const navigate = useNavigate()

    if (profileQuery.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar seu perfil agora. Tente novamente em instantes.
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
            <div className={styles.container}>
                <h1 className={styles.title}>Meu Perfil</h1>
                <Link className={styles.retroLink} to="/retrospectiva">
                    Minha retrospectiva do mês
                </Link>

                <div className={styles.layout}>
                    <div className={styles.main}>
                        <PublicProfileCard
                            profile={profileQuery.data.profile}
                            currentUserId={user.id}
                            targetUserId={user.id}
                            friends={[]}
                            sentRequests={[]}
                            receivedRequests={[]}
                            onEdit={() => navigate('/configuracoes')}
                        />
                    </div>

                    <aside className={styles.sidebar}>
                        <ProfileAboutPanel />
                    </aside>
                </div>
            </div>
        </main>
    )
}
