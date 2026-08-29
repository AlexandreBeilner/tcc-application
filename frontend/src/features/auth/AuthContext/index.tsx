import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '../../../services/auth'
import type { AuthUser } from '../../../services/auth'
import { ApiError, setUnauthorizedHandler } from '../../../services/client'
import type { AuthContextValue } from './types'

export type { AuthContextValue } from './types'

// localStorage, sem refresh token — mesmo padrão simples de SPA que RNF07
// não exige ir além nesta fase (tarefa 6.0.2).
const TOKEN_STORAGE_KEY = 'tcc.auth.token'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
    const [user, setUser] = useState<AuthUser | null>(null)
    // Deriva do token inicial, não de um efeito: sem token salvo não há nada
    // pra carregar, então já nasce `false` (evita um render extra só pra
    // desligar o loading de novo logo depois de montar).
    const [isLoading, setIsLoading] = useState<boolean>(() => localStorage.getItem(TOKEN_STORAGE_KEY) !== null)
    // Evita a corrida descrita em `login()` abaixo: sem isso, o efeito de
    // `GET /auth/me` dispararia de novo assim que `token` mudasse, mesmo
    // quando `login()` já recebeu o usuário pronto na própria resposta.
    const skipNextFetchRef = useRef(false)

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
    }, [])

    const login = useCallback((newToken: string, newUser?: AuthUser) => {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
        if (newUser) {
            skipNextFetchRef.current = true
            setUser(newUser)
            setIsLoading(false)
        } else {
            // Setado aqui, no mesmo batch de `setToken`, não só no efeito abaixo
            // — senão há um render intermediário com token novo e `isLoading`
            // ainda `false`, que deixa <ProtectedRoute> passar pro <AppShell> com
            // `user` ainda `null` antes do `GET /auth/me` resolver (flash da tela
            // errada antes do redirecionamento de onboarding).
            setIsLoading(true)
        }
        setToken(newToken)
    }, [])

    // Ponto único de reação a 401 de qualquer endpoint (critério de aceite
    // 6.0.2) — o cliente HTTP não conhece React, só chama este handler.
    useEffect(() => {
        setUnauthorizedHandler(logout)
        return () => setUnauthorizedHandler(null)
    }, [logout])

    useEffect(() => {
        if (!token) {
            return
        }

        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false
            return
        }

        let cancelled = false
        setIsLoading(true)
        getCurrentUser(token)
            .then((result) => {
                if (!cancelled) setUser(result.user)
            })
            .catch((err) => {
                // Só um 401 de verdade (token inválido/expirado) invalida a sessão
                // — um erro de rede ou 5xx transitório na checagem inicial não pode
                // deslogar o usuário por baixo dele.
                if (!cancelled && err instanceof ApiError && err.status === 401) {
                    logout()
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [token, logout])

    const value = useMemo(() => ({ token, user, isLoading, login, logout, setUser }), [token, user, isLoading, login, logout])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth precisa ser usado dentro de <AuthProvider>')
    }
    return ctx
}
