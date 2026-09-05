import { useState } from 'react'
import { Select } from '../../components/atoms/Select'
import { FriendRequestsPanel } from '../../components/organisms/FriendRequestsPanel'
import { useFriendRequestsQuery } from '../../features/friendships/useFriendRequestsQuery'
import type { FriendsSortOrder } from '../../services/friendships'
import styles from './index.module.css'

const SORT_OPTIONS = [
    { value: 'desc', label: 'Mais recentes' },
    { value: 'asc', label: 'Mais antigas' },
]

// Tela 8.3 — "Aceitar" move o par pra amigos confirmados e atualiza 8.1
// (invalidação de cache cuida disso, `useRespondToFriendRequestMutation`);
// "Recusar"/"Cancelar" removem a solicitação (mesma rota, papéis
// diferentes por quem chama — `.docs/backend/friendships.md`). Paginação
// independente por lista e ordenação por data (6.9.1) — trocar a
// ordenação reseta as duas páginas pra 1, mesmo raciocínio de
// `Classificacao`.
export function SolicitacoesAmizade() {
    const [receivedPage, setReceivedPage] = useState(1)
    const [sentPage, setSentPage] = useState(1)
    const [sort, setSort] = useState<FriendsSortOrder>('desc')
    const requestsQuery = useFriendRequestsQuery(receivedPage, sentPage, sort)

    function changeSort(next: FriendsSortOrder) {
        setSort(next)
        setReceivedPage(1)
        setSentPage(1)
    }

    return (
        <main className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Solicitações de amizade</h1>
                <Select
                    value={sort}
                    onChange={(value) => changeSort(value as FriendsSortOrder)}
                    options={SORT_OPTIONS}
                    aria-label="Ordenar solicitações"
                />
            </div>

            {requestsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas solicitações agora. Tente novamente em instantes.
                </p>
            )}

            {!requestsQuery.data && !requestsQuery.isError && <p className={styles.loading}>Carregando solicitações…</p>}

            {requestsQuery.data && (
                <FriendRequestsPanel
                    received={requestsQuery.data.received.items}
                    sent={requestsQuery.data.sent.items}
                    receivedPage={requestsQuery.data.received.page}
                    receivedTotalPages={requestsQuery.data.received.totalPages}
                    onReceivedPageChange={setReceivedPage}
                    sentPage={requestsQuery.data.sent.page}
                    sentTotalPages={requestsQuery.data.sent.totalPages}
                    onSentPageChange={setSentPage}
                />
            )}
        </main>
    )
}
