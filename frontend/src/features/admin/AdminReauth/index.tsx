import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ReauthDialog } from '../../../components/organisms/ReauthDialog'
import { reauthenticate } from '../../../services/auth'
import { ApiError, REAUTH_REQUIRED } from '../../../services/client'
import { useAuth } from '../../auth/AuthContext'
import type { AdminReauthContextValue } from './types'

export type { AdminReauthContextValue } from './types'

// Ação destrutiva cancelada na janela de senha (N.22).
export class ReauthCancelledError extends Error {
    constructor() {
        super('Ação cancelada: senha não confirmada.')
        this.name = 'ReauthCancelledError'
    }
}

interface PendingPrompt {
    resolve: (token: string) => void
    reject: (err: Error) => void
}

const AdminReauthContext = createContext<AdminReauthContextValue | undefined>(undefined)

function isReauthRequired(err: unknown): boolean {
    return err instanceof ApiError && err.status === 401 && err.message === REAUTH_REQUIRED
}

// Montado no template do painel (`AdminShell`). Os hooks de ação destrutiva
// embrulham a chamada em `withReauth`: o admin só vê a janela de senha quando
// a conferência recente venceu, e a ação segue de onde parou.
export function AdminReauthProvider({ children }: { children: ReactNode }) {
    const { token, user, login } = useAuth()
    const tokenRef = useRef(token)
    useEffect(() => {
        tokenRef.current = token
    }, [token])
    const [prompt, setPrompt] = useState<PendingPrompt | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    const askPassword = useCallback(
        () =>
            new Promise<string>((resolve, reject) => {
                setError(null)
                setPrompt({ resolve, reject })
            }),
        [],
    )

    const withReauth = useCallback(
        async <T,>(run: (token: string) => Promise<T>): Promise<T> => {
            try {
                return await run(tokenRef.current as string)
            } catch (err) {
                if (!isReauthRequired(err)) throw err
                const freshToken = await askPassword()
                return run(freshToken)
            }
        },
        [askPassword],
    )

    const submit = async (password: string) => {
        if (!prompt) return
        setPending(true)
        setError(null)
        try {
            const result = await reauthenticate(tokenRef.current as string, password)
            login(result.token, user ?? undefined)
            prompt.resolve(result.token)
            setPrompt(null)
        } catch (err) {
            setError(
                err instanceof ApiError && err.status === 401 ? 'Senha incorreta.' : 'Não foi possível confirmar a senha. Tente de novo.',
            )
        } finally {
            setPending(false)
        }
    }

    const cancel = () => {
        prompt?.reject(new ReauthCancelledError())
        setPrompt(null)
    }

    const value = useMemo(() => ({ withReauth }), [withReauth])

    return (
        <AdminReauthContext.Provider value={value}>
            {children}
            {prompt && <ReauthDialog error={error} pending={pending} onSubmit={submit} onCancel={cancel} />}
        </AdminReauthContext.Provider>
    )
}

export function useAdminReauth(): AdminReauthContextValue {
    const ctx = useContext(AdminReauthContext)
    if (!ctx) {
        throw new Error('useAdminReauth precisa ser usado dentro de <AdminReauthProvider>')
    }
    return ctx
}
