import { ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { ProFaq } from '../../components/molecules/ProFaq'
import { ProBenefitsShowcase } from '../../components/organisms/ProBenefitsShowcase'
import { ProComparisonTable } from '../../components/organisms/ProComparisonTable'
import { describePlan } from '../../features/billing/describePlan'
import { isNativeApp, nativePlatform } from '../../features/billing/isNativeApp'
import { useReportFunnel } from '../../features/billing/useReportFunnel'
import { usePurchaseFlow } from '../../features/billing/usePurchaseFlow'
import { useBillingStatusQuery } from '../../features/billing/useBillingStatus'
import { useWebPlansQuery } from '../../features/billing/useWebPlans'
import { useInstallMode } from '../../features/pwa/install'
import { annualDiscountPercent, annualPerMonth, annualSavings } from '../../features/billing/webPurchases'
import type { WebPlan } from '../../features/billing/webPurchases'
import type { BillingStatus, FunnelSource } from '../../services/billing'
import styles from './index.module.css'
import { SUPPORT_EMAIL } from '../../utils/supportContact'

const FUNNEL_SOURCES: FunnelSource[] = ['league', 'duel', 'cosmetics', 'retrospective', 'assembly', 'portfolio', 'menu', 'header']

// Ponto de convite de onde a pessoa veio (o `ProInvite` manda no estado do link); sem ele, abriu
// os planos direto.
function funnelSourceFrom(state: unknown): FunnelSource {
    const source = typeof state === 'object' && state !== null ? (state as { proSource?: unknown }).proSource : undefined
    return FUNNEL_SOURCES.find((candidate) => candidate === source) ?? 'direct'
}

const PLAN_NAMES: Record<string, string> = { monthly: 'mensal', annual: 'anual' }

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR')
}

function CurrentPlan({ status }: { status: BillingStatus }) {
    // Dentro do app, quem assinou por outra plataforma lê que o PRO já vale aqui (nunca há nova compra).
    const notice = describePlan(status, isNativeApp(), nativePlatform()).instruction
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
            {notice && <p className={styles.note}>{notice}</p>}
            <Link to="/configuracoes" className={styles.link}>
                Gerenciar em Configurações
            </Link>
        </section>
    )
}

interface PlanCardProps {
    plan: WebPlan
    caption: string | null
    onChoose: ((plan: WebPlan) => void) | null
    busy: boolean
}

function PlanCard({ plan, caption, onChoose, busy }: PlanCardProps) {
    return (
        <article className={styles.planCard}>
            <h3 className={styles.planName}>{plan.id === 'monthly' ? 'Mensal' : 'Anual'}</h3>
            <p className={styles.price}>{plan.formattedPrice}</p>
            <p className={styles.period}>{plan.id === 'monthly' ? 'por mês' : 'por ano'}</p>
            {caption && <p className={styles.caption}>{caption}</p>}
            {onChoose && (
                <Button onClick={() => onChoose(plan)} disabled={busy}>
                    Assinar {plan.id === 'monthly' ? 'mensal' : 'anual'}
                </Button>
            )}
        </article>
    )
}

function PlanOptions({ plans, onChoose, busy }: { plans: WebPlan[]; onChoose: PlanCardProps['onChoose']; busy: boolean }) {
    const monthly = plans.find((plan) => plan.id === 'monthly')
    const annual = plans.find((plan) => plan.id === 'annual')
    const discount = monthly && annual ? annualDiscountPercent(monthly, annual) : null
    const savings = monthly && annual ? annualSavings(monthly, annual) : null

    return (
        <div className={styles.plans}>
            {monthly && <PlanCard plan={monthly} caption={null} onChoose={onChoose} busy={busy} />}
            {annual && (
                <PlanCard
                    plan={annual}
                    onChoose={onChoose}
                    busy={busy}
                    caption={`Equivale a ${annualPerMonth(annual)} por mês${
                        savings && discount ? `. Você economiza ${savings} por ano (${discount}% a menos que pagar mês a mês)` : ''
                    }`}
                />
            )}
        </div>
    )
}

// Tela de planos (MO.3.1). Os preços vêm do Offering do RevenueCat, nunca de texto fixo; a
// compra é a web (MO.3.2) ou, dentro do app, a nativa pela ponte (MO.4.2), com o preço da loja.
// Sem escassez, sem contador: só o convite.
export function Planos() {
    const installMode = useInstallMode()
    const statusQuery = useBillingStatusQuery()
    const status = statusQuery.data
    const billingEnabled = status?.billingEnabled ?? false
    const plansQuery = useWebPlansQuery(billingEnabled && !status?.isPro)
    const purchase = usePurchaseFlow()
    const reportFunnel = useReportFunnel()
    const source = funnelSourceFrom(useLocation().state)
    const showsPlans = Boolean(status && billingEnabled && !status.isPro)
    const busy = purchase.phase === 'checkout' || purchase.phase === 'restoring' || purchase.phase === 'confirming'
    const restoring = purchase.action === 'restore'

    // Funil (MO.7.1): abriu os planos como quem ainda pode assinar (quem já é PRO ou com a cobrança
    // desligada não conta).
    useEffect(() => {
        if (showsPlans) reportFunnel({ event: 'plans_opened', source })
    }, [showsPlans, source, reportFunnel])

    function choosePlan(plan: WebPlan) {
        reportFunnel({ event: 'purchase_started', source, plan: plan.id })
        void purchase.start(plan)
    }

    return (
        <main className={styles.page}>
            <Link to="/configuracoes" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar
            </Link>
            <h1 className={styles.title}>Plano PRO</h1>
            <p className={styles.lead}>
                Ligas e duelos com os amigos, identidade no perfil, retrospectiva completa e voz nas assembleias, tudo em um plano só.
            </p>

            {statusQuery.isPending && <p className={styles.note}>Carregando…</p>}
            {statusQuery.isError && (
                <p className={styles.error}>Não foi possível carregar o seu plano agora. Tente novamente em instantes.</p>
            )}

            <div className={styles.layout}>
                <div className={styles.main}>
                    <div className={styles.showcase}>
                        <ProBenefitsShowcase />
                    </div>
                    <div className={styles.compare}>
                        <ProComparisonTable />
                    </div>
                    <div className={styles.faq}>
                        <ProFaq />
                    </div>
                </div>

                <aside className={styles.side}>
                    {status?.isPro ? (
                        <CurrentPlan status={status} />
                    ) : status && (!billingEnabled || !purchase.canPurchase) ? (
                        <p className={styles.notice}>A assinatura ainda não está disponível. Avisamos assim que abrir.</p>
                    ) : status ? (
                        <section className={styles.card} aria-label="Escolha seu plano">
                            <h2 className={styles.sectionTitle}>Escolha seu plano</h2>
                            {plansQuery.isPending && <p className={styles.note}>Carregando preços…</p>}
                            {plansQuery.isError && (
                                <p className={styles.error}>Não foi possível carregar os preços agora. Tente novamente em instantes.</p>
                            )}
                            {plansQuery.data && plansQuery.data.length > 0 && (
                                <PlanOptions plans={plansQuery.data} onChoose={choosePlan} busy={busy} />
                            )}
                            <ul className={styles.assurances}>
                                <li>
                                    <ShieldCheck size={16} aria-hidden="true" /> Garantia de 7 dias: devolvemos o valor integral
                                </li>
                                <li>
                                    <RotateCcw size={16} aria-hidden="true" /> Cancele quando quiser, em Configurações
                                </li>
                            </ul>
                            <p className={styles.note}>
                                A assinatura renova sozinha a cada período e você cancela quando quiser. Ao assinar, você concorda com os{' '}
                                <Link to="/termos">Termos de Uso e da Assinatura PRO</Link>. Pode desistir em até 7 dias e receber o valor
                                de volta: veja a <Link to="/reembolso">Política de Reembolso</Link>.
                            </p>
                            {purchase.canRestore && (
                                <div className={styles.restore}>
                                    <Button variant="secondary" onClick={purchase.restore} disabled={busy}>
                                        Restaurar compras
                                    </Button>
                                    <p className={styles.note}>Já assinou antes, ou trocou de aparelho? Restaure a sua assinatura.</p>
                                </div>
                            )}
                            {purchase.phase === 'restoring' && <p className={styles.notice}>Procurando as suas compras…</p>}
                            {purchase.phase === 'confirming' && (
                                <p className={styles.notice}>
                                    {restoring
                                        ? 'Encontramos a sua assinatura. Estamos liberando o seu PRO, só um instante.'
                                        : 'Pagamento recebido. Estamos liberando o seu PRO, só um instante.'}
                                </p>
                            )}
                            {purchase.phase === 'nothing-to-restore' && (
                                <p className={styles.notice}>
                                    Não encontramos nenhuma assinatura ativa nesta conta da loja. Se você assinou por outro caminho, como a
                                    web, o seu PRO aparece aqui quando você entra com a mesma conta do Selucra.
                                </p>
                            )}
                            {purchase.phase === 'timeout' && (
                                <p className={styles.notice}>
                                    {restoring
                                        ? `Encontramos a sua assinatura, mas a confirmação está demorando. Volte em alguns minutos. Se o PRO não aparecer, fale com o suporte (${SUPPORT_EMAIL}).`
                                        : `Seu pagamento está demorando para ser confirmado. Não pague de novo: volte em alguns minutos. Se o PRO não aparecer, fale com o suporte (${SUPPORT_EMAIL}).`}
                                </p>
                            )}
                            {purchase.phase === 'error' && (
                                <p className={styles.error}>
                                    {restoring
                                        ? 'Não foi possível restaurar as suas compras agora. Tente de novo em instantes.'
                                        : 'Não foi possível concluir a assinatura agora. Confira o seu plano em alguns minutos antes de tentar de novo.'}
                                </p>
                            )}
                        </section>
                    ) : null}
                </aside>
            </div>

            {/* LW.1.2: sem prometer data. Dentro do app nativo o aviso não faz sentido. */}
            {!isNativeApp() && (
                <p className={styles.note}>
                    App Android e iOS em breve.
                    {installMode !== 'none' && (
                        <>
                            {' '}
                            Por enquanto, <Link to="/configuracoes">instale a Selucra na tela inicial</Link>.
                        </>
                    )}
                </p>
            )}
        </main>
    )
}
