import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { FriendsList } from '../../components/organisms/FriendsList'
import { useFriendRequestsQuery } from '../../features/friendships/useFriendRequestsQuery'
import { useFriendsQuery } from '../../features/friendships/useFriendsQuery'
import styles from './index.module.css'

// Tela 8.1 (hub) — ponto central do sistema social (inventário), acesso
// pelo menu do avatar (0.2, `/amigos`). "Contador de solicitações
// pendentes" conta só as recebidas (ação do usuário), não as enviadas — a
// distinção completa (recebidas × enviadas) é conteúdo de 8.3.
export function Amigos() {
    const navigate = useNavigate()
    const friendsQuery = useFriendsQuery()
    const requestsQuery = useFriendRequestsQuery()
    const pendingCount = requestsQuery.data?.received.length ?? 0

    return (
        <main className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Amigos</h1>
                <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => navigate('/amigos/solicitacoes')}>
                        Solicitações{pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </Button>
                    <Button onClick={() => navigate('/amigos/buscar')}>Buscar amigos</Button>
                </div>
            </div>

            {friendsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar seus amigos agora. Tente novamente em instantes.
                </p>
            )}

            {!friendsQuery.data && !friendsQuery.isError && <p className={styles.loading}>Carregando amigos…</p>}

            {friendsQuery.data && <FriendsList friends={friendsQuery.data.friends} />}
        </main>
    )
}
