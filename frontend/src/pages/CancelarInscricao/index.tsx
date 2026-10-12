import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { AuthCard } from '../../components/templates/AuthCard'
import { EMAIL_CATEGORY_COPY } from '../../features/emailPreferences/emailCategoryCopy'
import { ApiError } from '../../services/client'
import { unsubscribeByToken } from '../../services/emailPreferences'
import type { EmailCategory } from '../../services/emailPreferences'
import { formatApiError } from '../../utils/formatApiError'
import type { UnsubscribeState } from './types'
import styles from './index.module.css'

function readTokenFromHash(): string | null {
    return new URLSearchParams(window.location.hash.slice(1)).get('token')
}

// Tira o fragmento da barra de endereço, para o token não ficar no histórico nem numa captura de tela.
function clearHash(): void {
    if (window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
}

// Cancelar inscrição (EM.6.1, rota pública `/cancelar-inscricao#token=...`). Não exige login: o
// token assinado do link do e-mail é a autorização. Abrir a página nunca cancela sozinho (scanners
// de e-mail abrem todo link): só o botão confirma. Cancelar vale para a categoria do e-mail em
// questão e se desfaz em Configurações.
export function CancelarInscricao() {
    const [token] = useState(readTokenFromHash)
    const [state, setState] = useState<UnsubscribeState>(token === null ? 'invalid' : 'ready')
    const [category, setCategory] = useState<EmailCategory | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        clearHash()
    }, [])

    function confirm() {
        if (token === null) return
        setState('working')
        setError(null)
        unsubscribeByToken(token)
            .then((result) => {
                setCategory(result.category)
                setState('done')
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 400) {
                    setState('invalid')
                } else {
                    setError(formatApiError(err, 'Não foi possível cancelar agora. Tente de novo.'))
                    setState('failed')
                }
            })
    }

    if (state === 'done') {
        return (
            <AuthCard subtitle="Inscrição cancelada">
                <div className={styles.block} role="status">
                    <p className={styles.title}>Pronto, você não vai mais receber esses e-mails</p>
                    {category && (
                        <p>Desligamos os {EMAIL_CATEGORY_COPY[category].label}. Os avisos de segurança da conta continuam chegando.</p>
                    )}
                    <p>Mudou de ideia? Você pode ligar de novo em Configurações, na seção E-mails.</p>
                </div>
                <Link className={styles.back} to="/configuracoes">
                    Ir para Configurações
                </Link>
            </AuthCard>
        )
    }

    if (state === 'invalid') {
        return (
            <AuthCard subtitle="Link inválido">
                <div className={styles.block} role="alert">
                    <p className={styles.title}>Este link não funciona</p>
                    <p>
                        O link pode estar incompleto ou ter sido alterado. Para escolher quais e-mails receber, entre na sua conta e abra
                        Configurações.
                    </p>
                </div>
                <Link className={styles.back} to="/configuracoes">
                    Ir para Configurações
                </Link>
            </AuthCard>
        )
    }

    return (
        <AuthCard subtitle="Cancelar inscrição">
            <div className={styles.block}>
                <p className={styles.title}>Quer deixar de receber estes e-mails?</p>
                <p>Você continua recebendo os avisos de segurança da conta, como a redefinição de senha.</p>
            </div>
            {state === 'failed' && error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <Button onClick={confirm} disabled={state === 'working'}>
                {state === 'working' ? 'Cancelando…' : 'Cancelar inscrição'}
            </Button>
            <Link className={styles.back} to="/">
                Manter e voltar para a plataforma
            </Link>
        </AuthCard>
    )
}
