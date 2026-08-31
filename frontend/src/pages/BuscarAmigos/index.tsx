import { useState } from 'react'
import { UserSearchResults } from '../../components/organisms/UserSearchResults'
import { useAuth } from '../../features/auth/AuthContext'
import { useAllFriendRequestsQuery } from '../../features/friendships/useAllFriendRequestsQuery'
import { useAllFriendsQuery } from '../../features/friendships/useAllFriendsQuery'
import { useSearchUsersQuery } from '../../features/friendships/useSearchUsersQuery'
import styles from './index.module.css'

// Tela 8.2 — todo usuário é buscável, sem perfil privado nesta fase
// (CLAUDE.md). Busca só dispara com pelo menos 1 caractere
// (`useSearchUsersQuery`); estado inicial (campo vazio) não é "nenhum
// resultado encontrado", é só "ainda não buscou nada".
export function BuscarAmigos() {
    const [term, setTerm] = useState('')
    const { user } = useAuth()
    const searchQuery = useSearchUsersQuery(term)
    const friendsQuery = useAllFriendsQuery()
    const requestsQuery = useAllFriendRequestsQuery()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Buscar amigos</h1>

            <label className={styles.field}>
                Nome de usuário
                <input
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Digite um username…"
                    autoFocus
                />
            </label>

            {term.trim().length > 0 && (
                <>
                    {searchQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível buscar agora. Tente novamente em instantes.
                        </p>
                    )}

                    {!searchQuery.data && !searchQuery.isError && <p className={styles.loading}>Buscando…</p>}

                    {searchQuery.data && user && (
                        <UserSearchResults
                            results={searchQuery.data.users}
                            currentUserId={user.id}
                            friends={friendsQuery.data ?? []}
                            sentRequests={requestsQuery.data?.sent ?? []}
                            receivedRequests={requestsQuery.data?.received ?? []}
                        />
                    )}
                </>
            )}
        </main>
    )
}
