import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBillingStatusQuery } from '../../features/billing/useBillingStatus'
import { useWebPlansQuery } from '../../features/billing/useWebPlans'
import { annualDiscountPercent, annualPerMonth } from '../../features/billing/webPurchases'
import type { WebPlan } from '../../features/billing/webPurchases'
import type { BillingStatus } from '../../services/billing'
import styles from './index.module.css'

const PRO_BENEFITS = [
    'Ligas privadas e duelos com seus amigos',
    'Moldura, título e selo PRO no seu perfil',
    'Retrospectiva do mês para compartilhar',
    'Voto nas Assembleias de Acionistas das empresas que você tem',
]

const ALWAYS_FREE = [
    'Todas as lições e o mapa da trilha',
    'Simulação de Renda Fixa e Renda Variável, com compra e venda sem limite',
    'XP, nível, sequência, missões e conquistas',
    'Ranking, amigos e feed',
]

const PLAN_NAMES: Record<string, string> = { monthly: 'mensal', annual: 'anual' }

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR')
}

function CurrentPlan({ status }: { status: BillingStatus }) {
    const planName = status.plan ? PLAN_NAMES[status.plan] : null
    return (
        <section className={styles.current} aria-label="Seu plano">
            <h2 className={styles.sectionTitle}>Você já é PRO</h2>
            <p className={styles.note}>
                {planName ? `Plano ${planName}. ` : ''}
                {status.expiresAt
                    ? status.willRenew
                        ? `Renova em ${formatDate(status.expiresAt)}.`
                        : `PRO até ${formatDate(status.expiresAt)}.`
                    : 'Sem data de término.'}
            </p>
            <Link to="/configuracoes" className={styles.link}>
                Gerenciar em Configurações
            </Link>
        </section>
    )
}

function PlanCard({ plan, caption }: { plan: WebPlan; caption: string | null }) {
    return (
        <article className={styles.planCard}>
            <h3 className={styles.planName}>{plan.id === 'monthly' ? 'Mensal' : 'Anual'}</h3>
            <p className={styles.price}>{plan.formattedPrice}</p>
            <p className={styles.period}>{plan.id === 'monthly' ? 'por mês' : 'por ano'}</p>
            {caption && <p className={styles.caption}>{caption}</p>}
        </article>
    )
}

function PlanOptions({ plans }: { plans: WebPlan[] }) {
    const monthly = plans.find((plan) => plan.id === 'monthly')
    const annual = plans.find((plan) => plan.id === 'annual')
    const discount = monthly && annual ? annualDiscountPercent(monthly, annual) : null

    return (
        <div className={styles.plans}>
            {monthly && <PlanCard plan={monthly} caption={null} />}
            {annual && (
                <PlanCard
                    plan={annual}
                    caption={`Equivale a ${annualPerMonth(annual)} por mês${discount ? `, ${discount}% a menos que pagar mês a mês` : ''}`}
                />
            )}
        </div>
    )
}

// Tela de planos (MO.3.1). Os preços vêm do Offering do RevenueCat, nunca de texto fixo; a
// compra em si entra na MO.3.2. Sem escassez, sem contador: só o convite.
export function Planos() {
    const statusQuery = useBillingStatusQuery()
    const status = statusQuery.data
    const billingEnabled = status?.billingEnabled ?? false
    const plansQuery = useWebPlansQuery(billingEnabled && !status?.isPro)

    return (
        <main className={styles.page}>
            <Link to="/configuracoes" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar
            </Link>
            <h1 className={styles.title}>Plano PRO</h1>
            <p className={styles.lead}>
                O PRO deixa a plataforma mais divertida de jogar com os amigos. O que você já usa continua grátis, para sempre.
            </p>

            {statusQuery.isPending && <p className={styles.note}>Carregando…</p>}
            {statusQuery.isError && (
                <p className={styles.error}>Não foi possível carregar o seu plano agora. Tente novamente em instantes.</p>
            )}

            <div className={styles.layout}>
                <div className={styles.main}>
                    <section className={styles.card} aria-label="O que o PRO inclui">
                        <h2 className={styles.sectionTitle}>O que o PRO inclui</h2>
                        <ul className={styles.list}>
                            {PRO_BENEFITS.map((item) => (
                                <li key={item}>
                                    <Check size={16} aria-hidden="true" /> {item}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className={styles.card} aria-label="O que continua grátis">
                        <h2 className={styles.sectionTitle}>O que continua grátis</h2>
                        <ul className={styles.list}>
                            {ALWAYS_FREE.map((item) => (
                                <li key={item}>
                                    <Check size={16} aria-hidden="true" /> {item}
                                </li>
                            ))}
                        </ul>
                        <p className={styles.note}>
                            Se você cancelar, nada do que você conquistou é apagado. Só as vantagens PRO ficam em pausa.
                        </p>
                    </section>
                </div>

                <aside className={styles.side}>
                    {status?.isPro ? (
                        <CurrentPlan status={status} />
                    ) : status && !billingEnabled ? (
                        <p className={styles.notice}>A assinatura ainda não está disponível. Avisamos assim que abrir.</p>
                    ) : status ? (
                        <section className={styles.card} aria-label="Escolha seu plano">
                            <h2 className={styles.sectionTitle}>Escolha seu plano</h2>
                            {plansQuery.isPending && <p className={styles.note}>Carregando preços…</p>}
                            {plansQuery.isError && (
                                <p className={styles.error}>Não foi possível carregar os preços agora. Tente novamente em instantes.</p>
                            )}
                            {plansQuery.data && plansQuery.data.length > 0 && <PlanOptions plans={plansQuery.data} />}
                        </section>
                    ) : null}
                </aside>
            </div>
        </main>
    )
}
