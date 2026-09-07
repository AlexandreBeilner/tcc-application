import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Select } from '../../components/atoms/Select'
import { FriendsList } from '../../components/organisms/FriendsList'
import { RecentActivityFeed } from '../../components/organisms/RecentActivityFeed'
import { useFriendRequestsQuery } from '../../features/friendships/useFriendRequestsQuery'
import { useFriendsQuery } from '../../features/friendships/useFriendsQuery'
import { useFeedQuery } from '../../features/socialfeed/useFeedQuery'
import type { FriendsSortOrder } from '../../services/friendships'
import styles from './index.module.css'

const SORT_OPTIONS = [
    { value: 'desc', label: 'Mais recentes' },
    { value: 'asc', label: 'Mais antigas' },
]

// Tela 8.1 (hub) — ponto central do sistema social (inventário), acesso
// pelo menu do avatar (0.2, `/amigos`). "Contador de solicitações
// pendentes" conta só as recebidas (ação do usuário), não as enviadas — a
// distinção completa (recebidas × enviadas) é conteúdo de 8.3. Paginação
// e ordenação por data (6.9.1) — página 1 só pras solicitações, já que
// este hub só mostra o contador, não a lista (isso é 8.3).
export function Amigos() {
    const navigate = useNavigate()
    const [page, setPage] = useState(1)
    const [sort, setSort] = useState<FriendsSortOrder>('desc')
    const friendsQuery = useFriendsQuery(page, sort)
    const requestsQuery = useFriendRequestsQuery(1, 1, 'desc')
    const feedQuery = useFeedQuery()
    const pendingCount = requestsQuery.data?.received.totalEntries ?? 0

    function changeSort(next: FriendsSortOrder) {
        setSort(next)
        setPage(1)
    }

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

            {feedQuery.data && <RecentActivityFeed events={feedQuery.data.events} />}

            {friendsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar seus amigos agora. Tente novamente em instantes.
                </p>
            )}

            {!friendsQuery.data && !friendsQuery.isError && <p className={styles.loading}>Carregando amigos…</p>}

            {friendsQuery.data && friendsQuery.data.friends.length > 0 && (
                <div className={styles.sortRow}>
                    <Select
                        value={sort}
                        onChange={(value) => changeSort(value as FriendsSortOrder)}
                        options={SORT_OPTIONS}
                        aria-label="Ordenar amigos"
                    />
                </div>
            )}

            {friendsQuery.data && (
                <FriendsList
                    friends={friendsQuery.data.friends}
                    page={friendsQuery.data.page}
                    totalPages={friendsQuery.data.totalPages}
                    onPageChange={setPage}
                />
            )}
        </main>
    )
}
