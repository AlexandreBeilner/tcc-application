import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

// Destino do redirect final do OAuth Google (tela 1.1, tarefa 6.2):
// `.docs/backend/auth.md` (GET /auth/google/callback) manda o navegador
// pra `${FRONTEND_URL}/auth/callback#token=<jwt>` — o token vem no
// *fragment* da URL, nunca na query string, de propósito (não vazar em
// logs de servidor/proxy). Por isso lê `window.location.hash`, não
// `useSearchParams`. Rota isenta do proxy de dev (vite.config.ts,
// `FRONTEND_ROUTES_SHADOWING_BACKEND`) porque colide por prefixo com
// `/auth/*` do backend.
export function AuthCallback() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [failed, setFailed] = useState(false)
    const handled = useRef(false)

    useEffect(() => {
        if (handled.current) return
        handled.current = true

        const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
        if (!token) {
            setFailed(true)
            return
        }

        login(token)
        // Decisão 1.2 (onboarding) vs. 2.1 (Portfólio) fica com <AppShell>,
        // a partir de `user.onboardingCompleted` — mesma decisão central do
        // login/cadastro por e-mail, nunca duplicada aqui.
        navigate('/', { replace: true })
    }, [login, navigate])

    if (failed) {
        return (
            <main>
                <p>Não foi possível concluir o login com Google.</p>
            </main>
        )
    }

    return <main />
}
