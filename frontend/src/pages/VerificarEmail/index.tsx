import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ResendVerification } from '../../components/organisms/ResendVerification'
import { AuthCard } from '../../components/templates/AuthCard'
import { ApiError, isTokenUsedError } from '../../services/client'
import { verifyEmail } from '../../services/auth'
import { formatApiError } from '../../utils/formatApiError'
import type { VerificationState } from './types'
import styles from './index.module.css'

function readTokenFromHash(): string | null {
    return new URLSearchParams(window.location.hash.slice(1)).get('token')
}

// Tira o fragmento da barra de endereço, para o token não ficar no histórico nem numa captura de
// tela. Idempotente (StrictMode roda o efeito duas vezes).
function clearHash(): void {
    if (window.location.hash) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
}

// Verificação de e-mail (EM.3.3, rota `/verificar-email#token=...`). O link do e-mail consome o
// token ao abrir: é de uso único, então a chamada roda uma vez só (o `ref` segura o StrictMode).
// Não cria sessão: depois de confirmar, a pessoa entra pelo login. Link vencido, já usado ou sem
// token cai no mesmo estado, com o pedido de um link novo sempre à mão.
export function VerificarEmail() {
    const [token] = useState(readTokenFromHash)
    const [state, setState] = useState<VerificationState>(token === null ? 'invalid' : 'verifying')
    const [error, setError] = useState<string | null>(null)
    const started = useRef(false)
    const navigate = useNavigate()

    // Fora do efeito para o "Tentar de novo" repetir a chamada com o token que já está no estado
    // (o fragmento sai da barra de endereço, então recarregar a página perderia o link).
    function verify(value: string) {
        setState('verifying')
        verifyEmail(value)
            .then(() => setState('verified'))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 410) {
                    setState(isTokenUsedError(err) ? 'used' : 'expired')
                } else if (err instanceof ApiError && err.status === 401) {
                    setState('invalid')
                } else {
                    setError(formatApiError(err, 'Não foi possível confirmar o e-mail agora. Tente de novo.'))
                    setState('failed')
                }
            })
    }

    useEffect(() => {
        clearHash()
        if (token === null || started.current) return
        started.current = true
        verify(token)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    if (state === 'verifying') {
        return (
            <AuthCard subtitle="Confirmando seu e-mail">
                <p className={styles.text} role="status">
                    Só um instante...
                </p>
            </AuthCard>
        )
    }

    if (state === 'verified') {
        return (
            <AuthCard subtitle="E-mail confirmado">
                <div className={styles.block} role="status">
                    <p className={styles.title}>Pronto, seu e-mail foi confirmado</p>
                    <p>Agora é só entrar com o seu e-mail e a sua senha.</p>
                </div>
                <Button onClick={() => navigate('/login', { replace: true })}>Ir para a entrada</Button>
            </AuthCard>
        )
    }

    if (state === 'failed') {
        return (
            <AuthCard subtitle="Algo deu errado">
                <p className={styles.error} role="alert">
                    {error}
                </p>
                <Button onClick={() => token && verify(token)}>Tentar de novo</Button>
                <Link className={styles.back} to="/login">
                    Voltar para a entrada
                </Link>
            </AuthCard>
        )
    }

    return (
        <AuthCard subtitle="Link inválido">
            <div className={styles.block} role="alert">
                {state === 'used' ? (
                    <>
                        <p className={styles.title}>Este link já foi usado</p>
                        <p>Se você já confirmou o e-mail, é só entrar. Se não, peça um link novo abaixo.</p>
                    </>
                ) : (
                    <>
                        <p className={styles.title}>Este link não vale mais</p>
                        <p>
                            O link pode ter expirado (ele vale por 24 horas), ter sido substituído por um pedido mais novo ou estar
                            incompleto. Peça um novo abaixo.
                        </p>
                    </>
                )}
            </div>
            <ResendVerification />
            <Link className={styles.back} to="/login">
                Voltar para a entrada
            </Link>
        </AuthCard>
    )
}
