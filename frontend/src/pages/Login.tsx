import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ApiError } from '../services/client'
import { googleLoginUrl, login as loginRequest, register as registerRequest } from '../services/auth'
import styles from './Login.module.css'

type Mode = 'login' | 'register'

// Tela 1.1 (tarefa 6.2) — login e cadastro na mesma tela, com um toggle
// entre os dois modos (inventário não separa em duas telas). Pós-sucesso,
// sempre navega pra "/" e deixa <AppShell> decidir 1.2 (onboarding) vs.
// 2.1 (Portfólio) a partir de `user.onboardingCompleted` — a mesma decisão
// central usada pelo retorno do OAuth Google (AuthCallback), nunca
// duplicada aqui.
export function Login() {
    const [mode, setMode] = useState<Mode>('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    function toggleMode() {
        setMode((m) => (m === 'login' ? 'register' : 'login'))
        setError(null)
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)
        try {
            const result =
                mode === 'login' ? await loginRequest({ email, password }) : await registerRequest({ name, email, username, password })
            login(result.token, result.user)
            navigate('/', { replace: true })
        } catch (err) {
            // 401 (login) e 409 (cadastro, e-mail/username) já chegam com
            // mensagens distintas do backend (.docs/backend/auth.md) — exibir
            // `err.message` direto satisfaz os dois casos sem remapear nada aqui.
            setError(err instanceof ApiError ? err.message : 'Não foi possível completar a operação.')
            setIsSubmitting(false)
        }
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.brand}>Investimenta</h1>
                <p className={styles.subtitle}>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</p>

                <a className={styles.google} href={googleLoginUrl()}>
                    Entrar com Google
                </a>

                <div className={styles.divider}>
                    <span>ou</span>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <label className={styles.field}>
                            Nome
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                                maxLength={100}
                                autoComplete="name"
                            />
                        </label>
                    )}

                    <label className={styles.field}>
                        E-mail
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            maxLength={100}
                            autoComplete="email"
                        />
                    </label>

                    {mode === 'register' && (
                        <label className={styles.field}>
                            Nome de usuário
                            <input
                                type="text"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                                minLength={3}
                                maxLength={30}
                                pattern="[a-z0-9_]+"
                                title="Só letras minúsculas, números e _"
                                autoComplete="username"
                            />
                        </label>
                    )}

                    <label className={styles.field}>
                        Senha
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={8}
                            maxLength={72}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />
                    </label>

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" className={styles.submit} disabled={isSubmitting}>
                        {mode === 'login' ? 'Entrar' : 'Criar conta'}
                    </button>
                </form>

                <button type="button" className={styles.toggle} onClick={toggleMode}>
                    {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
                </button>

                <p className={styles.terms}>Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.</p>
            </div>
        </main>
    )
}
