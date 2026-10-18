import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { reportDiarioOrigin } from '../../features/diario/origin'
import { computePasswordStrength } from '../../features/auth/passwordStrength'
import { captureReferralCode, clearReferralCode } from '../../features/referral/referralCode'
import { isAccountSuspendedError, isEmailNotVerifiedError } from '../../services/client'
import { ApiError } from '../../services/client'
import { formatApiError } from '../../utils/formatApiError'
import { googleLoginUrl, login as loginRequest, register as registerRequest } from '../../services/auth'
import { BrandLogo } from '../../components/atoms/BrandLogo'
import { Button } from '../../components/atoms/Button'
import { ResendVerification } from '../../components/organisms/ResendVerification'
import { AuthCard } from '../../components/templates/AuthCard'
import type { Mode } from './types'
import styles from './index.module.css'
import { SUPPORT_EMAIL } from '../../utils/supportContact'

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
const SUSPENDED_MESSAGE = `Sua conta está suspensa. Fale com o suporte (${SUPPORT_EMAIL}) para entender o motivo.`

//
// Verificação de e-mail (EM.3.3, D2): o cadastro não cria sessão, mostra o aviso "enviamos um
// link" com o reenvio à mão. Login de conta por e-mail e senha ainda não verificada (403
// `email_not_verified`, só depois da senha conferir) mostra o aviso no próprio formulário, com o
// reenvio sempre visível.
export function Login() {
    // Convite (MO.7.2): quem chega por `/login?ref=CODIGO` abre direto no cadastro, e o código
    // acompanha a pessoa até o envio (ou até o login com Google, que o leva na URL).
    const { search } = useLocation()
    const [referralCode] = useState(() => captureReferralCode(search))
    // A landing (selucra.com.br) chama `/login?modo=cadastro` no botão "Criar conta".
    const opensSignup = new URLSearchParams(search).get('modo') === 'cadastro'
    const [mode, setMode] = useState<Mode>(referralCode || opensSignup ? 'register' : 'login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    // E-mail do cadastro recém-feito (aviso "enviamos um link") ou do login recusado por e-mail não verificado.
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
    const [registered, setRegistered] = useState(false)
    const { login, token } = useAuth()
    const navigate = useNavigate()
    const passwordStrength = mode === 'register' ? computePasswordStrength(password) : null

    function toggleMode() {
        setMode((m) => (m === 'login' ? 'register' : 'login'))
        setError(null)
        setPendingVerificationEmail(null)
        setConfirmPassword('')
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)
        setPendingVerificationEmail(null)

        if (mode === 'register' && password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setIsSubmitting(true)
        try {
            if (mode === 'register') {
                // Sem sessão: a conta só entra depois de confirmar o e-mail.
                await registerRequest({ name, email, username, password, ...(referralCode ? { referralCode } : {}) })
                clearReferralCode()
                reportDiarioOrigin('signup')
                setPassword('')
                setConfirmPassword('')
                setRegistered(true)
                setIsSubmitting(false)
                return
            }
            const result = await loginRequest({ email, password })
            login(result.token, result.user)
            reportDiarioOrigin('login')
            navigate('/', { replace: true })
        } catch (err) {
            // 401 (login) e 409 (cadastro) chegam com mensagens distintas do backend
            // (.docs/backend/auth.md); `formatApiError` repassa as duas.
            if (isEmailNotVerifiedError(err)) {
                setPendingVerificationEmail(email)
            } else if (isAccountSuspendedError(err)) {
                setError(SUSPENDED_MESSAGE)
            } else if (err instanceof ApiError && err.status === 429) {
                // Limite de tentativas do backend (por IP e por e-mail); não revela nada sobre contas.
                setError('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.')
            } else {
                setError(formatApiError(err, 'Não foi possível completar a operação.'))
            }
            setIsSubmitting(false)
        }
    }

    // Sessão já salva (ex: veio da landing pelo "Entrar"): não mostra o login de novo, segue pro app.
    // Um token expirado cai no 401 da checagem inicial, que desloga e deixa o login aparecer.
    if (token) {
        return <Navigate to="/" replace />
    }

    if (registered) {
        return (
            <AuthCard subtitle="Confirme seu e-mail">
                <div className={styles.notice} role="status">
                    <p className={styles.noticeTitle}>Enviamos um link para {email}</p>
                    <p>
                        Abra o e-mail e use o link para confirmar que o endereço é seu. O link vale por 24 horas. Só depois disso a conta
                        entra. Não chegou? Veja a caixa de spam ou peça um novo link.
                    </p>
                </div>
                <ResendVerification email={email} />
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => {
                        setRegistered(false)
                        setMode('login')
                    }}
                >
                    Já confirmei, quero entrar
                </button>
            </AuthCard>
        )
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.brand}>
                    <BrandLogo className={styles.brandLogo} />
                </h1>
                <p className={styles.subtitle}>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</p>

                <a className={styles.google} href={googleLoginUrl(referralCode)}>
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

                    {mode === 'login' && (
                        <Link className={styles.forgot} to="/esqueci-senha">
                            Esqueci minha senha
                        </Link>
                    )}

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

                    {pendingVerificationEmail && (
                        <div className={styles.notice} role="alert">
                            <p className={styles.noticeTitle}>Falta confirmar seu e-mail</p>
                            <p>
                                A senha está certa, mas esta conta ainda não confirmou o e-mail. Abra o link que enviamos para{' '}
                                {pendingVerificationEmail} ou peça um novo.
                            </p>
                        </div>
                    )}

                    <Button type="submit" disabled={isSubmitting}>
                        {mode === 'login' ? 'Entrar' : 'Criar conta'}
                    </Button>
                </form>

                {pendingVerificationEmail && <ResendVerification email={pendingVerificationEmail} />}

                <button type="button" className={styles.toggle} onClick={toggleMode}>
                    {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
                </button>

                <p className={styles.terms}>
                    Ao continuar, você concorda com os <Link to="/termos">Termos de Uso</Link> e com a{' '}
                    <Link to="/privacidade">Política de Privacidade</Link>.
                </p>
            </div>
        </main>
    )
}
