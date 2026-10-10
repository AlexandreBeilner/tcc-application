import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { AuthCard } from '../../components/templates/AuthCard'
import { useAuth } from '../../features/auth/AuthContext'
import { computePasswordStrength } from '../../features/auth/passwordStrength'
import { ApiError } from '../../services/client'
import { resetPassword } from '../../services/auth'
import { formatApiError } from '../../utils/formatApiError'
import styles from './index.module.css'

const STRENGTH_LABEL: Record<'weak' | 'medium' | 'strong', string> = {
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
}

function readTokenFromHash(): string | null {
    return new URLSearchParams(window.location.hash.slice(1)).get('token')
}

// Tira o fragmento da barra de endereço, para o token não ficar no histórico nem numa captura de
// tela. O fragmento já não vai ao servidor nem ao `Referer`. Idempotente, então o efeito pode
// rodar duas vezes (StrictMode) sem perder o token, que já está no estado.
function clearHash(): void {
    if (window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
}

// Redefinição de senha (EM.2.3, rota `/redefinir-senha`). Mesma regra de senha do cadastro
// (8 a 72 caracteres, confirmação, indicador de força). Link sem token, expirado ou já usado
// cai no mesmo estado, com o caminho para pedir outro link.
export function RedefinirSenha() {
    const [token] = useState(readTokenFromHash)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [done, setDone] = useState(false)
    const [linkInvalid, setLinkInvalid] = useState(token === null)
    const { logout } = useAuth()
    const navigate = useNavigate()
    const strength = computePasswordStrength(password)

    useEffect(clearHash, [])

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setIsSubmitting(true)
        try {
            await resetPassword({ token: token ?? '', newPassword: password })
            // O backend encerrou todas as sessões; limpa a deste navegador também.
            logout()
            setDone(true)
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 410)) {
                setLinkInvalid(true)
            } else if (err instanceof ApiError && err.status === 429) {
                setError('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.')
            } else {
                setError(formatApiError(err, 'Não foi possível redefinir a senha. Tente de novo.'))
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    if (done) {
        return (
            <AuthCard subtitle="Senha redefinida">
                <div className={styles.sent} role="status">
                    <p className={styles.sentTitle}>Pronto, sua senha foi alterada</p>
                    <p>As sessões abertas em outros aparelhos foram encerradas. Entre com a senha nova.</p>
                </div>
                <Button onClick={() => navigate('/login', { replace: true })}>Ir para a entrada</Button>
            </AuthCard>
        )
    }

    if (linkInvalid) {
        return (
            <AuthCard subtitle="Link inválido">
                <div className={styles.sent} role="alert">
                    <p className={styles.sentTitle}>Este link não vale mais</p>
                    <p>
                        O link pode ter expirado (ele vale por 30 minutos), já ter sido usado ou ter sido substituído por um pedido mais
                        novo.
                    </p>
                </div>
                <Button onClick={() => navigate('/esqueci-senha', { replace: true })}>Pedir um novo link</Button>
                <Link className={styles.back} to="/login">
                    Voltar para a entrada
                </Link>
            </AuthCard>
        )
    }

    return (
        <AuthCard subtitle="Escolha uma senha nova">
            <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.field}>
                    Senha nova
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                    />
                </label>

                {strength && (
                    <div className={styles.strength} aria-live="polite">
                        <div className={`${styles.strengthBar} ${styles[strength]}`}>
                            <span className={`${styles.strengthSegment} ${styles.strengthFilled}`} />
                            <span className={`${styles.strengthSegment} ${strength !== 'weak' ? styles.strengthFilled : ''}`} />
                            <span className={`${styles.strengthSegment} ${strength === 'strong' ? styles.strengthFilled : ''}`} />
                        </div>
                        <span className={`${styles.strengthLabel} ${styles[strength]}`}>Força da senha: {STRENGTH_LABEL[strength]}</span>
                    </div>
                )}

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
                <p className={styles.hint}>De 8 a 72 caracteres.</p>

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                <Button type="submit" disabled={isSubmitting}>
                    Redefinir senha
                </Button>
            </form>
        </AuthCard>
    )
}
