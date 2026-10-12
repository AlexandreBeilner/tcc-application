import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { AuthCard } from '../../components/templates/AuthCard'
import { ApiError } from '../../services/client'
import { requestPasswordReset } from '../../services/auth'
import { formatApiError } from '../../utils/formatApiError'
import styles from './index.module.css'

// Pedido de recuperação de senha (EM.2.3). A resposta do backend é sempre a mesma, exista a
// conta ou não, então esta tela também é: depois de enviar, mostra o mesmo aviso para qualquer
// e-mail ("se existir uma conta..."), nunca "e-mail não encontrado". O único erro específico é o
// limite de pedidos (429), que não revela nada sobre contas.
export function EsqueciSenha() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sentTo, setSentTo] = useState<string | null>(null)

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)
        try {
            await requestPasswordReset(email)
            setSentTo(email)
        } catch (err) {
            setError(
                err instanceof ApiError && err.status === 429
                    ? 'Você fez pedidos demais em pouco tempo. Aguarde alguns minutos e tente de novo.'
                    : formatApiError(err, 'Não foi possível enviar o pedido. Tente de novo.'),
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    if (sentTo) {
        return (
            <AuthCard subtitle="Confira seu e-mail">
                <div className={styles.sent} role="status">
                    <p className={styles.sentTitle}>Pedido enviado</p>
                    <p>
                        Se existir uma conta com o e-mail {sentTo}, enviamos um link para escolher uma senha nova. O link vale por 30
                        minutos e só pode ser usado uma vez.
                    </p>
                    <p>Não chegou? Veja a caixa de spam ou peça um novo link.</p>
                </div>
                <Button variant="secondary" onClick={() => setSentTo(null)}>
                    Pedir outro link
                </Button>
                <Link className={styles.back} to="/login">
                    Voltar para a entrada
                </Link>
            </AuthCard>
        )
    }

    return (
        <AuthCard subtitle="Recuperar senha">
            <form className={styles.form} onSubmit={handleSubmit}>
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
                <p className={styles.hint}>Enviaremos um link para você escolher uma senha nova.</p>

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                <Button type="submit" disabled={isSubmitting}>
                    Enviar link
                </Button>
            </form>
            <Link className={styles.back} to="/login">
                Voltar para a entrada
            </Link>
        </AuthCard>
    )
}
