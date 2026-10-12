import { BadgeCheck, Swords, Users, Vote } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dismissProInvite, isProInviteDismissed } from '../../../features/billing/proInviteDismissal'
import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import { useReportFunnel } from '../../../features/billing/useReportFunnel'
import styles from './index.module.css'

const BENEFITS = [
    { Icon: Users, text: 'Ligas privadas com seus amigos' },
    { Icon: Swords, text: 'Duelos 1 contra 1 por 7 dias' },
    { Icon: BadgeCheck, text: 'Selo, moldura e título no seu perfil' },
    { Icon: Vote, text: 'Voz nas assembleias: vota em todas e propõe pautas' },
]

// Cartão "O que o PRO traz" do Portfólio (MO.9.8). Informa, não pressiona: sem preço, sem prazo,
// sem texto que culpe. Dispensável por 30 dias (mesmo mecanismo do `ProInvite`, contexto
// `portfolio`) e nunca aparece para quem já é PRO nem com a cobrança desligada.
export function ProBenefitsCard() {
    const billing = useBillingStatusQuery().data
    const [dismissed, setDismissed] = useState(() => isProInviteDismissed('portfolio'))
    const reportFunnel = useReportFunnel()
    const visible = Boolean(billing && !billing.isPro && billing.billingEnabled && !dismissed)

    useEffect(() => {
        if (visible) reportFunnel({ event: 'invite_viewed', source: 'portfolio' })
    }, [visible, reportFunnel])

    if (!visible) return null

    function handleDismiss() {
        dismissProInvite('portfolio')
        setDismissed(true)
    }

    return (
        <section className={styles.card} aria-labelledby="pro-benefits-title">
            <h2 id="pro-benefits-title" className={styles.title}>
                O que o PRO traz
            </h2>
            <ul className={styles.list}>
                {BENEFITS.map(({ Icon, text }) => (
                    <li key={text} className={styles.item}>
                        <span className={styles.icon} aria-hidden="true">
                            <Icon size={18} strokeWidth={2} />
                        </span>
                        {text}
                    </li>
                ))}
            </ul>
            <div className={styles.actions}>
                <Link className={styles.primary} to="/planos" state={{ proSource: 'portfolio' }}>
                    Ver planos
                </Link>
                <button type="button" className={styles.dismiss} onClick={handleDismiss}>
                    Agora não
                </button>
            </div>
        </section>
    )
}
