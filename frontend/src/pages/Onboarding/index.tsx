import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FastForward, Wallet, Target, Users, HandCoins, Mail } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { completeOnboarding } from '../../services/auth'
import { updateEmailPreferences } from '../../services/emailPreferences'
import type { EmailPreferences } from '../../services/emailPreferences'
import { FirstActionStep } from '../../components/organisms/FirstActionStep'
import { EmailCategoryOption } from '../../components/molecules/EmailCategoryOption'
import { EMAIL_CATEGORIES, EMAIL_CATEGORY_COPY } from '../../features/emailPreferences/emailCategoryCopy'
import { Button } from '../../components/atoms/Button'
import { formatCurrency } from '../../features/portfolio/format'
import styles from './index.module.css'
import { formatApiError } from '../../utils/formatApiError'

// Tela 1.2 (tarefa 6.2) — carrossel de 3 telas curtas (inventário 1.2),
// só na primeira sessão após cadastro. CTA final "Começar" e "pular"
// (sempre disponível) levam pro mesmo lugar: 3.1 Mapa da Trilha (`/trilha`,
// backlog 6.2 — não 2.1 Portfólio, força o primeiro contato com a lição
// 0.1) — depois de marcar `onboardingCompleted` via `PATCH /me` (6.0.4),
// nunca um flag local. Ícone por slide (identidade-visual-padroes.md,
// Octalysis "Epic Meaning") — a única variação visual antes era o texto.
// O slide do tempo acelerado (S.12) leva um desenho a mais (`visual: 'time'`):
// 1 dia real contra N dias de mercado e a semana com sábado e domingo tracejados.
// O slide do salário (T.11) reusa o mesmo padrão de `compareBox` (`visual: 'salary'`):
// dois níveis de referência mostrando o valor crescendo, mesmo `HandCoins` do
// resto do salário (`SalaryIndicator`/`CalendarKindIcon`).
const WEEK_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex'] as const
const WEEKEND_DAYS = ['sáb', 'dom'] as const
const SALARY_LEVEL_EXAMPLES = [10, 30] as const

// Fórmula pura duplicada do backend (`backend/src/modules/payroll/domain/salary.ts`,
// fonte real, ver T.3); frontend/backend não compartilham código TS (mesmo tipo
// de duplicação já aceito no reveal de level-up, T.10, e na Fase S/T.6 entre Go
// e Node) — aqui só pra ilustrar os valores de referência do slide, sem
// round-trip pro backend.
function monthlySalaryForLevel(level: number): number {
    const tier = Math.ceil(level / 10)
    const fullTiersSum = (1000 * (tier - 1) * tier) / 2
    const levelsIntoTier = level - 10 * (tier - 1)
    return fullTiersSum + 100 * tier * levelsIntoTier
}

interface Slide {
    title: string
    body: string
    Icon: typeof Wallet
    visual?: 'time' | 'salary'
    // Slide que vira ação (OB.1.2): a compra guiada no Modo Aprendizado.
    action?: 'firstAction'
}

const SLIDES: Slide[] = [
    {
        title: 'Você começa com R$ 10.000 simulados',
        body: 'Esse é o seu capital inicial no mercado ao vivo: dinheiro de mentira, decisões de verdade.',
        Icon: Wallet,
    },
    {
        title: 'Aprenda fazendo, não lendo',
        body: 'A trilha ensina cada produto com uma decisão prática antes de liberar ele pra investir de verdade. Vamos começar agora, com uma compra de treino no Modo Aprendizado.',
        Icon: Target,
        action: 'firstAction',
    },
    {
        title: 'Aqui o tempo passa mais rápido',
        body: 'Para você ver o efeito dos investimentos sem esperar meses, o mercado simulado anda 5 dias a cada dia real. Como no mundo real, ele fecha no sábado e no domingo: nesses dias você estuda, faz lições e treina no Modo Aprendizado, e as ordens esperam a segunda.',
        Icon: FastForward,
        visual: 'time',
    },
    {
        title: 'Seu salário cresce com você',
        body: 'Além do que você ganha investindo, todo mês você recebe um salário simulado que sobe conforme seu nível sobe. Ele cai sozinho na sua conta no 5º dia útil do mês, sem precisar fazer nada.',
        Icon: HandCoins,
        visual: 'salary',
    },
    {
        title: 'Compita com amigos, não só com estranhos',
        body: 'Adicione amigos e acompanhe quem rende mais no ranking, sem expor o valor do seu patrimônio.',
        Icon: Users,
    },
]

// Passo final (EM.6.1, D8): pergunta se a pessoa quer e-mails opcionais. Tudo começa desligado, e
// "Pular" nunca liga nada. A escolha é gravada em `finish()` junto com o fim do onboarding.
const PREFERENCES_STEP = SLIDES.length
const STEP_COUNT = SLIDES.length + 1

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

function SalaryVisual() {
    return (
        <div className={styles.timeVisual}>
            <div className={`${styles.compare} ${styles.compareTwo}`}>
                {SALARY_LEVEL_EXAMPLES.map((level) => (
                    <div key={level} className={styles.compareBox}>
                        <b>{formatCurrency(monthlySalaryForLevel(level))}</b>
                        <span>no nível {level}</span>
                    </div>
                ))}
            </div>
            <p className={styles.timeHint}>Marcado no Calendário no dia em que cai, todo mês.</p>
        </div>
    )
}

export function Onboarding() {
    const { token, user, setUser } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [emailChoices, setEmailChoices] = useState<EmailPreferences>({ social: false, engagement: false })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Compra guiada do slide "Aprenda fazendo" (OB.1.2): sem ela resolvida, o botão principal vira "Pular esta etapa".
    const [firstActionSettled, setFirstActionSettled] = useState(false)
    const isPreferencesStep = step === PREFERENCES_STEP

    // Onboarding concluído (segunda visita à URL, ex: voltar no navegador) —
    // não repetir o carrossel. `!isSubmitting` evita uma corrida com
    // `finish()`: `setUser` (abaixo) já deixa `user.onboardingCompleted`
    // `true` antes do router trocar de rota, o que re-renderiza este
    // componente (ainda montado) — sem a guarda, esse `<Navigate to="/">`
    // dispara e sobrepõe o `navigate('/trilha')` intencional do "Começar".
    if (user?.onboardingCompleted && !isSubmitting) {
        return <Navigate to="/" replace />
    }

    async function finish(saveEmailChoices: boolean) {
        if (isSubmitting || !token) return
        setIsSubmitting(true)
        setError(null)
        try {
            // Falhar em gravar a escolha de e-mail não trava o onboarding: o padrão é desligado
            // (nenhum e-mail opcional), e a pessoa liga depois em Configurações.
            if (saveEmailChoices && (emailChoices.social || emailChoices.engagement)) {
                await updateEmailPreferences(token, emailChoices).catch(() => undefined)
            }
            const result = await completeOnboarding(token)
            setUser(result.user)
            // `fromOnboarding`: a trilha abre o popup de instalação do app uma única vez (InstallPrompt).
            navigate('/trilha', { replace: true, state: { fromOnboarding: true } })
        } catch (err) {
            setError(formatApiError(err, 'Não foi possível continuar. Tente novamente.'))
            setIsSubmitting(false)
        }
    }

    function handleNext() {
        if (isPreferencesStep) {
            void finish(true)
            return
        }
        setStep((s) => s + 1)
    }

    const slide = isPreferencesStep ? null : SLIDES[step]
    const isPendingFirstAction = slide?.action === 'firstAction' && !firstActionSettled

    return (
        <main className={styles.page}>
            <button type="button" className={styles.skip} onClick={() => void finish(false)}>
                Pular
            </button>

            {slide ? (
                <div className={styles.slide}>
                    <span className={styles.icon} aria-hidden="true">
                        <slide.Icon size={28} strokeWidth={2} />
                    </span>
                    <h1 className={styles.title}>{slide.title}</h1>
                    <p className={styles.body}>{slide.body}</p>
                    {slide.visual === 'time' && <TimeVisual />}
                    {slide.visual === 'salary' && <SalaryVisual />}
                    {slide.action === 'firstAction' && <FirstActionStep onSettled={() => setFirstActionSettled(true)} />}
                </div>
            ) : (
                <div className={styles.slide}>
                    <span className={styles.icon} aria-hidden="true">
                        <Mail size={28} strokeWidth={2} />
                    </span>
                    <h1 className={styles.title}>Quer receber e-mails da plataforma?</h1>
                    <p className={styles.body}>
                        Tudo começa desligado e você muda quando quiser em Configurações. Os avisos de segurança da conta, como redefinir a
                        senha, sempre são enviados.
                    </p>
                    <div className={styles.optIn}>
                        {EMAIL_CATEGORIES.map((category) => (
                            <EmailCategoryOption
                                key={category}
                                title={EMAIL_CATEGORY_COPY[category].title}
                                description={EMAIL_CATEGORY_COPY[category].description}
                                checked={emailChoices[category]}
                                disabled={isSubmitting}
                                onChange={(checked) => setEmailChoices((current) => ({ ...current, [category]: checked }))}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.footer}>
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}
                <div className={styles.dots}>
                    {Array.from({ length: STEP_COUNT }, (_, index) => (
                        <span key={index} className={index === step ? `${styles.dot} ${styles.dotActive}` : styles.dot} />
                    ))}
                </div>
                <Button fullWidth variant={isPendingFirstAction ? 'secondary' : 'primary'} onClick={handleNext} disabled={isSubmitting}>
                    {isPreferencesStep ? 'Começar' : isPendingFirstAction ? 'Pular esta etapa' : 'Próximo'}
                </Button>
            </div>
        </main>
    )
}
