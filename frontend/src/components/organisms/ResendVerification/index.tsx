import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Button } from '../../atoms/Button'
import { ApiError } from '../../../services/client'
import { resendVerification } from '../../../services/auth'
import { formatApiError } from '../../../utils/formatApiError'
import type { ResendVerificationProps } from './types'
import styles from './index.module.css'

// Reenvio do link de verificação (EM.3.3). Fica sempre visível onde a pessoa pode estar presa
// (pós-cadastro, login recusado, link vencido): quem não verificou nunca fica sem caminho. A
// resposta do backend é igual para qualquer e-mail, então o aviso também é.
export function ResendVerification({ email: knownEmail }: ResendVerificationProps) {
    const [typedEmail, setTypedEmail] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const email = knownEmail ?? typedEmail

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault()
        setError(null)
        setIsSending(true)
        try {
            await resendVerification(email)
            setSent(true)
        } catch (err) {
            setError(
                err instanceof ApiError && err.status === 429
                    ? 'Você pediu links demais em pouco tempo. Aguarde alguns minutos e tente de novo.'
                    : formatApiError(err, 'Não foi possível reenviar o e-mail. Tente de novo.'),
            )
        } finally {
            setIsSending(false)
        }
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            {knownEmail === undefined && (
                <label className={styles.field}>
                    E-mail da conta
                    <input
                        type="email"
                        value={typedEmail}
                        onChange={(event) => setTypedEmail(event.target.value)}
                        required
                        maxLength={100}
                        autoComplete="email"
                    />
                </label>
            )}

            {sent && (
                <p className={styles.sent} role="status">
                    Se houver uma conta aguardando confirmação com esse e-mail, enviamos um novo link. Veja também a caixa de spam. O link
                    anterior deixou de valer.
                </p>
            )}

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <Button type="submit" variant="secondary" disabled={isSending}>
                {sent ? 'Reenviar de novo' : 'Reenviar e-mail de confirmação'}
            </Button>
        </form>
    )
}
