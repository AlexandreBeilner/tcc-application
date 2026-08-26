import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getCurrentUser } from '../api/auth'
import type { AuthUser } from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'

// localStorage, sem refresh token — mesmo padrão simples de SPA que RNF07
// não exige ir além nesta fase (tarefa 6.0.2).
const TOKEN_STORAGE_KEY = 'tcc.auth.token'

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  isLoading: boolean
  login(token: string): void
  logout(): void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  // Deriva do token inicial, não de um efeito: sem token salvo não há nada
  // pra carregar, então já nasce `false` (evita um render extra só pra
  // desligar o loading de novo logo depois de montar).
  const [isLoading, setIsLoading] = useState<boolean>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) !== null,
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const login = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
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

    let cancelled = false
    setIsLoading(true)
    getCurrentUser(token)
      .then((result) => {
        if (!cancelled) setUser(result.user)
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, logout])

  const value = useMemo(
    () => ({ token, user, isLoading, login, logout }),
    [token, user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>')
  }
  return ctx
}
