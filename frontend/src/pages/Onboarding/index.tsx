import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FastForward, Wallet, Target, Users } from 'lucide-react'
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
// nunca um flag local. Ícone por slide (identidade-visual-padroes.md,
// Octalysis "Epic Meaning") — a única variação visual antes era o texto.
// O slide do tempo acelerado (S.12) leva um desenho a mais (`visual: 'time'`):
// 1 dia real contra N dias de mercado e a semana com sábado e domingo tracejados.
const WEEK_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex'] as const
const WEEKEND_DAYS = ['sáb', 'dom'] as const

interface Slide {
    title: string
    body: string
    Icon: typeof Wallet
    visual?: 'time'
}

const SLIDES: Slide[] = [
    {
        title: 'Você começa com R$ 10.000 simulados',
        body: 'Esse é o seu capital inicial no mercado ao vivo: dinheiro de mentira, decisões de verdade.',
        Icon: Wallet,
    },
    {
        title: 'Aprenda fazendo, não lendo',
        body: 'A trilha ensina cada produto com uma decisão prática antes de liberar ele pra investir de verdade.',
        Icon: Target,
    },
    {
        title: 'Aqui o tempo passa mais rápido',
        body: 'Para você ver o efeito dos investimentos sem esperar meses, o mercado simulado anda 5 dias a cada dia real. Como no mundo real, ele fecha no sábado e no domingo: nesses dias você estuda, faz lições e treina no Modo Aprendizado, e as ordens esperam a segunda.',
        Icon: FastForward,
        visual: 'time',
    },
    {
        title: 'Compita com amigos, não só com estranhos',
        body: 'Adicione amigos e acompanhe quem rende mais no ranking, sem expor o valor do seu patrimônio.',
        Icon: Users,
    },
]

function TimeVisual() {
    return (
        <div className={styles.timeVisual}>
            <div className={styles.compare}>
                <div className={styles.compareBox}>
                    <b>1 dia</b>
                    <span>no seu relógio</span>
                </div>
                <FastForward size={22} strokeWidth={2} aria-hidden="true" />
                <div className={styles.compareBox}>
                    <b>5 dias</b>
                    <span>no mercado</span>
                </div>
            </div>
            <div
                className={styles.weekbar}
                role="img"
                aria-label="Semana do mercado: aberto de segunda a sexta, fechado no sábado e no domingo"
            >
                {WEEK_DAYS.map((day) => (
                    <span key={day} className={styles.weekDay}>
                        {day}
                    </span>
                ))}
                {WEEKEND_DAYS.map((day) => (
                    <span key={day} className={`${styles.weekDay} ${styles.weekDayClosed}`}>
                        {day}
                    </span>
                ))}
            </div>
            <p className={styles.timeHint}>Você acompanha tudo pelo relógio no topo da tela e pelo Calendário.</p>
        </div>
    )
}

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
                <span className={styles.icon} aria-hidden="true">
                    <slide.Icon size={28} strokeWidth={2} />
                </span>
                <h1 className={styles.title}>{slide.title}</h1>
                <p className={styles.body}>{slide.body}</p>
                {slide.visual === 'time' && <TimeVisual />}
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
