import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { computePasswordStrength } from '../../features/auth/passwordStrength'
import { isAccountSuspendedError } from '../../services/client'
import { formatApiError } from '../../utils/formatApiError'
import { googleLoginUrl, login as loginRequest, register as registerRequest } from '../../services/auth'
import { Button } from '../../components/atoms/Button'
import type { Mode } from './types'
import styles from './index.module.css'

const STRENGTH_LABEL: Record<'weak' | 'medium' | 'strong', string> = {
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
}

// Tela 1.1 (tarefa 6.2) — login e cadastro na mesma tela, com um toggle
// entre os dois modos (inventário não separa em duas telas). Pós-sucesso,
// sempre navega pra "/" e deixa <AppShell> decidir 1.2 (onboarding) vs.
// 2.1 (Portfólio) a partir de `user.onboardingCompleted` — a mesma decisão
// central usada pelo retorno do OAuth Google (AuthCallback), nunca
// duplicada aqui.
//
// Tarefa 6.10.6 (apontado pelo autor, tecnicamente da 6.2): cadastro ganhou
// "Confirmar senha" (validação client-side, mesmo princípio já usado em
// 9.2/`Configuracoes`) e um indicador visual de força
// (`features/auth/passwordStrength`, heurística pura e testada) — nenhum
// dos dois existe no modo login, só no `register`.
// Texto da recusa de login de conta suspensa pelo painel (N.16); o backend só manda o código.
const SUSPENDED_MESSAGE = 'Sua conta está suspensa. Fale com o suporte para entender o motivo.'

export function Login() {
    const [mode, setMode] = useState<Mode>('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()
    const passwordStrength = mode === 'register' ? computePasswordStrength(password) : null

    function toggleMode() {
        setMode((m) => (m === 'login' ? 'register' : 'login'))
        setError(null)
        setConfirmPassword('')
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)

        if (mode === 'register' && password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setIsSubmitting(true)
        try {
            const result =
                mode === 'login' ? await loginRequest({ email, password }) : await registerRequest({ name, email, username, password })
            login(result.token, result.user)
            navigate('/', { replace: true })
        } catch (err) {
            // 401 (login) e 409 (cadastro) chegam com mensagens distintas do backend
            // (.docs/backend/auth.md); `formatApiError` repassa as duas.
            if (isAccountSuspendedError(err)) {
                setError(SUSPENDED_MESSAGE)
            } else {
                setError(formatApiError(err, 'Não foi possível completar a operação.'))
            }
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

                    {passwordStrength && (
                        <div className={styles.strength} aria-live="polite">
                            <div className={`${styles.strengthBar} ${styles[passwordStrength]}`}>
                                <span className={`${styles.strengthSegment} ${styles.strengthFilled}`} />
                                <span className={`${styles.strengthSegment} ${passwordStrength !== 'weak' ? styles.strengthFilled : ''}`} />
                                <span
                                    className={`${styles.strengthSegment} ${passwordStrength === 'strong' ? styles.strengthFilled : ''}`}
                                />
                            </div>
                            <span className={`${styles.strengthLabel} ${styles[passwordStrength]}`}>
                                Força da senha: {STRENGTH_LABEL[passwordStrength]}
                            </span>
                        </div>
                    )}

                    {mode === 'register' && (
                        <label className={styles.field}>
                            Confirmar senha
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                required
                                minLength={8}
                                maxLength={72}
                                autoComplete="new-password"
                            />
                        </label>
                    )}

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <Button type="submit" disabled={isSubmitting}>
                        {mode === 'login' ? 'Entrar' : 'Criar conta'}
                    </Button>
                </form>

                <button type="button" className={styles.toggle} onClick={toggleMode}>
                    {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
                </button>

                <p className={styles.terms}>
                    Ao continuar, você concorda com a <Link to="/privacidade">Política de Privacidade</Link>.
                </p>
            </div>
        </main>
    )
}
