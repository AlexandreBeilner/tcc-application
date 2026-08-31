import { FriendRequestsPanel } from '../../components/organisms/FriendRequestsPanel'
import { useFriendRequestsQuery } from '../../features/friendships/useFriendRequestsQuery'
import styles from './index.module.css'

// Tela 8.3 — "Aceitar" move o par pra amigos confirmados e atualiza 8.1
// (invalidação de cache cuida disso, `useRespondToFriendRequestMutation`);
// "Recusar"/"Cancelar" removem a solicitação (mesma rota, papéis
// diferentes por quem chama — `.docs/backend/friendships.md`).
export function SolicitacoesAmizade() {
    const requestsQuery = useFriendRequestsQuery()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Solicitações de amizade</h1>

            {requestsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas solicitações agora. Tente novamente em instantes.
                </p>
            )}

            {!requestsQuery.data && !requestsQuery.isError && <p className={styles.loading}>Carregando solicitações…</p>}

            {requestsQuery.data && <FriendRequestsPanel received={requestsQuery.data.received} sent={requestsQuery.data.sent} />}
        </main>
    )
}
