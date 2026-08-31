import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { searchUsers } from '../../../services/friendships'
import type { SearchUsersResult } from '../../../services/friendships'

const DEBOUNCE_MS = 300

// Tela 8.2 — `term` muda a cada tecla digitada; debounce evita uma
// requisição por dígito (mesmo padrão de `useSimulateFixedIncomeQuery`,
// 6.0.5). Backend exige `q` com pelo menos 1 caractere
// (`.docs/backend/friendships.md`), então a query fica desabilitada com o
// campo vazio em vez de disparar um 400 previsível.
export function useSearchUsersQuery(term: string): UseQueryResult<SearchUsersResult> {
    const { token } = useAuth()
    const [debouncedTerm, setDebouncedTerm] = useState(term)

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedTerm(term), DEBOUNCE_MS)
        return () => clearTimeout(timeout)
    }, [term])

    return useQuery({
        queryKey: ['friendships', 'search', debouncedTerm] as const,
        queryFn: () => searchUsers(token as string, debouncedTerm),
        enabled: token !== null && debouncedTerm.trim().length > 0,
    })
}
