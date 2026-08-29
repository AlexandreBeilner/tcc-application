import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { completeOnboarding } from '../../services/auth'
import { ApiError } from '../../services/client'
import { Button } from '../../components/atoms/Button'
import styles from './index.module.css'

// Tela 1.2 (tarefa 6.2) — carrossel de 3 telas curtas (inventário 1.2),
// só na primeira sessão após cadastro. CTA final "Começar" e "pular"
// (sempre disponível) levam pro mesmo lugar: 3.1 Mapa da Trilha (`/trilha`,
// backlog 6.2 — não 2.1 Portfólio, força o primeiro contato com a lição
// 0.1) — depois de marcar `onboardingCompleted` via `PATCH /me` (6.0.4),
// nunca um flag local.
const SLIDES = [
    {
        title: 'Você começa com R$ 10.000 simulados',
        body: 'Esse é o seu capital inicial no mercado ao vivo — dinheiro de mentira, decisões de verdade.',
    },
    {
        title: 'Aprenda fazendo, não lendo',
        body: 'A trilha ensina cada produto com uma decisão prática antes de liberar ele pra investir de verdade.',
    },
    {
        title: 'Compita com amigos, não só com estranhos',
        body: 'Adicione amigos e acompanhe quem rende mais no ranking, sem expor o valor do seu patrimônio.',
    },
]

export function Onboarding() {
    const { token, user, setUser } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isLastSlide = step === SLIDES.length - 1

    // Onboarding concluído (segunda visita à URL, ex: voltar no navegador) —
    // não repetir o carrossel. `!isSubmitting` evita uma corrida com
    // `finish()`: `setUser` (abaixo) já deixa `user.onboardingCompleted`
    // `true` antes do router trocar de rota, o que re-renderiza este
    // componente (ainda montado) — sem a guarda, esse `<Navigate to="/">`
    // dispara e sobrepõe o `navigate('/trilha')` intencional do "Começar".
    if (user?.onboardingCompleted && !isSubmitting) {
        return <Navigate to="/" replace />
    }

    async function finish() {
        if (isSubmitting || !token) return
        setIsSubmitting(true)
        setError(null)
        try {
            const result = await completeOnboarding(token)
            setUser(result.user)
            navigate('/trilha', { replace: true })
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível continuar. Tente novamente.')
            setIsSubmitting(false)
        }
    }

    function handleNext() {
        if (isLastSlide) {
            void finish()
            return
        }
        setStep((s) => s + 1)
    }

    const slide = SLIDES[step]

    return (
        <main className={styles.page}>
            <button type="button" className={styles.skip} onClick={() => void finish()}>
                Pular
            </button>

            <div className={styles.slide}>
                <h1 className={styles.title}>{slide.title}</h1>
                <p className={styles.body}>{slide.body}</p>
            </div>

            <div className={styles.footer}>
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
                <div className={styles.dots}>
                    {SLIDES.map((s, index) => (
                        <span key={s.title} className={index === step ? `${styles.dot} ${styles.dotActive}` : styles.dot} />
                    ))}
                </div>
                <Button fullWidth onClick={handleNext} disabled={isSubmitting}>
                    {isLastSlide ? 'Começar' : 'Próximo'}
                </Button>
            </div>
        </main>
    )
}
